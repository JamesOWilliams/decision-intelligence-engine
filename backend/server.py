from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import uuid
import secrets
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Literal, List
from datetime import datetime, timezone

from scoring_engine import score_assessment, evaluate_blockers
from reasoning_service import (
    generate_reasoning,
    generate_executive_abstract,
    generate_comparison_explanation,
)
from comparison_service import compare_assessments
from demo_seed import DEMO_INITIATIVE, DEMO_EVIDENCE


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---- MongoDB ----
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ---- Ontology loader (versioned JSON in repo) ----
ONTOLOGY_PATH = ROOT_DIR / "ontology" / "organizational_readiness_v1.json"
with open(ONTOLOGY_PATH, "r", encoding="utf-8") as f:
    ONTOLOGY = json.load(f)

# Pre-compute blocker ids for fast validation
ONTOLOGY_BLOCKER_IDS = {b["id"] for b in ONTOLOGY.get("blockers", [])}
# Map dimension id -> name from ontology
ONTOLOGY_DIMENSION_IDS = {d["id"] for d in ONTOLOGY["domain"]["dimensions"]}

# Threshold below which a dimension is classified as a risk
RISK_THRESHOLD = 50

# ---- App ----
app = FastAPI(title="Decision Intelligence Engine — Organizational Readiness MVP")
api_router = APIRouter(prefix="/api")


# ===== Pydantic Models =====
StageT = Literal["discovery", "pilot", "production_candidate"]


class Initiative(BaseModel):
    name: str = ""
    business_unit: str = ""
    description: str = ""
    target_workflow: str = ""
    expected_outcomes: str = ""
    stage: Optional[StageT] = None


class AssessmentCreate(BaseModel):
    initiative: Optional[Initiative] = None
    evidence: Optional[Dict[str, str]] = None


class AssessmentPatch(BaseModel):
    initiative: Optional[Initiative] = None
    evidence: Optional[Dict[str, str]] = None
    status: Optional[Literal["draft", "in_progress", "completed"]] = None


class ShareCreateRequest(BaseModel):
    expires_in_days: Optional[int] = None


class RemediationSourceFinding(BaseModel):
    """Deterministic anchor — blocker id or dimension id from score snapshot."""
    type: Literal["blocker", "risk"]
    ref_id: str          # blocker.id OR dimension.id
    label: str           # human-readable label for display
    captured_score: Optional[int] = None
    captured_band: Optional[str] = None


class RemediationPlanCreate(BaseModel):
    source_assessment_id: str
    source_finding: RemediationSourceFinding
    objective: str


class RemediationActionCreate(BaseModel):
    description: str
    owner: Optional[str] = ""
    target_date: Optional[str] = None
    status: Literal["not_started", "in_progress", "complete"] = "not_started"
    evidence_requirement: Optional[str] = ""
    evidence_reference: Optional[str] = ""
    evidence_status: Literal["not_provided", "provided"] = "not_provided"


class RemediationActionPatch(BaseModel):
    description: Optional[str] = None
    owner: Optional[str] = None
    target_date: Optional[str] = None
    status: Optional[Literal["not_started", "in_progress", "complete"]] = None
    evidence_requirement: Optional[str] = None
    evidence_reference: Optional[str] = None
    evidence_status: Optional[Literal["not_provided", "provided"]] = None


class ComparisonExplanationRequest(BaseModel):
    from_assessment_id: str
    to_assessment_id: str


# ===== Helpers =====
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_assessment_doc(
    initiative: Optional[Initiative],
    evidence: Optional[Dict[str, str]],
    initiative_id: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "ontology_version": ONTOLOGY["version"],
        "initiative": (initiative.model_dump() if initiative else Initiative().model_dump()),
        "evidence": evidence or {},
        "status": "draft",
        "initiative_id": initiative_id,   # durable initiative link (may be None for legacy)
        "score_snapshot": None,           # frozen on first report generation
        "scored_at": None,                # ISO timestamp when snapshot was frozen
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "completed_at": None,
    }


async def _ensure_initiative_id(assessment_doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    D-C Legacy Migration: lazily create a durable Initiative for any assessment that
    lacks one. One Initiative per assessment — no name-based grouping.
    """
    if assessment_doc.get("initiative_id"):
        return assessment_doc

    emb = assessment_doc.get("initiative", {})
    initiative_doc = {
        "id": str(uuid.uuid4()),
        "name": emb.get("name", ""),
        "business_unit": emb.get("business_unit", ""),
        "description": emb.get("description", ""),
        "target_workflow": emb.get("target_workflow", ""),
        "expected_outcomes": emb.get("expected_outcomes", ""),
        "stage": emb.get("stage"),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.initiatives.insert_one(initiative_doc.copy())
    initiative_doc.pop("_id", None)

    await db.assessments.update_one(
        {"id": assessment_doc["id"]},
        {"$set": {"initiative_id": initiative_doc["id"]}},
    )
    assessment_doc["initiative_id"] = initiative_doc["id"]
    return assessment_doc


async def _get_assessment(assessment_id: str) -> Dict[str, Any]:
    doc = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Assessment not found")
    doc = await _ensure_initiative_id(doc)
    return doc


def _get_or_compute_scores(assessment_doc: Dict[str, Any]) -> Dict[str, Any]:
    """Return frozen score snapshot if present; otherwise compute from evidence."""
    if assessment_doc.get("score_snapshot"):
        return assessment_doc["score_snapshot"]
    return score_assessment(assessment_doc.get("evidence", {}), ONTOLOGY)


# ===== Routes =====
@api_router.get("/health")
async def health():
    return {"status": "ok", "ontology_version": ONTOLOGY["version"]}


@api_router.get("/ontology")
async def get_ontology():
    return ONTOLOGY


@api_router.post("/assessments")
async def create_assessment(payload: AssessmentCreate):
    doc = _new_assessment_doc(payload.initiative, payload.evidence)
    await db.assessments.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@api_router.get("/assessments/{assessment_id}")
async def get_assessment(assessment_id: str):
    return await _get_assessment(assessment_id)


@api_router.patch("/assessments/{assessment_id}")
async def patch_assessment(assessment_id: str, patch: AssessmentPatch):
    existing = await _get_assessment(assessment_id)

    # INV-001 / D-E: Completed assessments reject user-facing evidence/initiative modifications
    if existing["status"] == "completed":
        if patch.evidence is not None or patch.initiative is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Assessment is completed. Evidence and initiative data are immutable. "
                    "To produce a new readiness result, initiate a reassessment."
                ),
            )

    update: Dict[str, Any] = {"updated_at": _now_iso()}

    if patch.initiative is not None:
        merged = {**existing["initiative"], **patch.initiative.model_dump(exclude_unset=True)}
        update["initiative"] = merged

    if patch.evidence is not None:
        merged_evidence = {**existing.get("evidence", {}), **patch.evidence}
        update["evidence"] = merged_evidence

    if patch.status is not None:
        update["status"] = patch.status
        if patch.status == "completed":
            update["completed_at"] = _now_iso()

    await db.assessments.update_one({"id": assessment_id}, {"$set": update})
    return await _get_assessment(assessment_id)


@api_router.post("/assessments/{assessment_id}/score")
async def score_only(assessment_id: str):
    """Run deterministic scoring (no LLM). Useful for live Readiness Pulse."""
    doc = await _get_assessment(assessment_id)
    result = score_assessment(doc.get("evidence", {}), ONTOLOGY)
    return result


@api_router.post("/assessments/{assessment_id}/report")
async def generate_report(assessment_id: str):
    """
    Compute scores + generate LLM reasoning, persist as report, return it.

    INV-001 / D-B: If a score_snapshot already exists on the assessment, it is used
    unchanged. Narrative may be regenerated. The frozen score, scored_at, and
    historical evidence are never overwritten.
    """
    doc = await _get_assessment(assessment_id)

    # D-B: Freeze score snapshot on first completion; reuse on regeneration
    if doc.get("score_snapshot"):
        scores = doc["score_snapshot"]
    else:
        scores = score_assessment(doc.get("evidence", {}), ONTOLOGY)
        scored_at = _now_iso()
        await db.assessments.update_one(
            {"id": assessment_id},
            {"$set": {"score_snapshot": scores, "scored_at": scored_at}},
        )

    reasoning = await generate_reasoning(doc["initiative"], scores)

    report = {
        "id": str(uuid.uuid4()),
        "assessment_id": assessment_id,
        "initiative_id": doc.get("initiative_id"),
        "ontology_version": ONTOLOGY["version"],
        "initiative": doc["initiative"],
        "scores": scores,
        "reasoning": reasoning,
        "generated_at": _now_iso(),
    }

    # Replace narrative representation (never replaces frozen snapshot on assessment doc)
    await db.reports.delete_many({"assessment_id": assessment_id})
    await db.reports.insert_one(report.copy())

    # Mark assessment completed
    await db.assessments.update_one(
        {"id": assessment_id},
        {"$set": {"status": "completed", "completed_at": _now_iso(), "updated_at": _now_iso()}},
    )

    report.pop("_id", None)
    return report


@api_router.get("/assessments/{assessment_id}/report")
async def get_report(assessment_id: str):
    report = await db.reports.find_one({"assessment_id": assessment_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not yet generated")
    return report


@api_router.post("/assessments/seed-demo")
async def seed_demo():
    """Create (or refresh) the seeded demo assessment + report."""
    initiative = Initiative(**DEMO_INITIATIVE)
    doc = _new_assessment_doc(initiative, DEMO_EVIDENCE)
    doc["status"] = "completed"
    doc["completed_at"] = _now_iso()
    doc["is_demo"] = True

    # Freeze score snapshot at seed time
    scores = score_assessment(doc["evidence"], ONTOLOGY)
    doc["score_snapshot"] = scores
    doc["scored_at"] = _now_iso()

    # Replace existing demo if present
    await db.assessments.delete_many({"is_demo": True})
    await db.assessments.insert_one(doc.copy())

    # Ensure a durable initiative exists for the demo
    doc = await _ensure_initiative_id(doc)

    # Compute and store report
    reasoning = await generate_reasoning(doc["initiative"], scores)
    report = {
        "id": str(uuid.uuid4()),
        "assessment_id": doc["id"],
        "initiative_id": doc.get("initiative_id"),
        "ontology_version": ONTOLOGY["version"],
        "initiative": doc["initiative"],
        "scores": scores,
        "reasoning": reasoning,
        "generated_at": _now_iso(),
    }
    await db.reports.delete_many({"assessment_id": doc["id"]})
    await db.reports.insert_one(report.copy())
    report.pop("_id", None)

    return {"assessment_id": doc["id"], "report": report}


@api_router.get("/assessments/demo/current")
async def get_demo_assessment():
    """Fetch the current demo assessment id (seed lazily if missing)."""
    demo = await db.assessments.find_one({"is_demo": True}, {"_id": 0})
    if demo:
        return {"assessment_id": demo["id"]}
    seeded = await seed_demo()
    return {"assessment_id": seeded["assessment_id"]}


# ===== Share Briefing Routes =====

@api_router.post("/assessments/{assessment_id}/share")
async def create_share_link(assessment_id: str, payload: ShareCreateRequest = ShareCreateRequest()):
    report = await db.reports.find_one({"assessment_id": assessment_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not generated yet")

    existing = await db.share_links.find_one(
        {"assessment_id": assessment_id, "is_active": True, "revoked_at": None},
        {"_id": 0},
    )
    if existing:
        return existing

    abstract = await generate_executive_abstract(
        report["initiative"], report["scores"], report["reasoning"]
    )

    expires_at = None
    if payload.expires_in_days and payload.expires_in_days > 0:
        from datetime import timedelta
        expires_at = (
            datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)
        ).isoformat()

    share_doc = {
        "id": str(uuid.uuid4()),
        "token": secrets.token_urlsafe(32),
        "assessment_id": assessment_id,
        "report_id": report["id"],
        "executive_abstract": abstract,
        "created_at": _now_iso(),
        "expires_at": expires_at,
        "revoked_at": None,
        "is_active": True,
        "view_count": 0,
    }
    await db.share_links.insert_one(share_doc.copy())
    share_doc.pop("_id", None)
    return share_doc


@api_router.get("/assessments/{assessment_id}/share")
async def get_share_link(assessment_id: str):
    link = await db.share_links.find_one(
        {"assessment_id": assessment_id, "is_active": True, "revoked_at": None},
        {"_id": 0},
    )
    if not link:
        raise HTTPException(status_code=404, detail="No active share link for this assessment")
    return {
        "id": link["id"],
        "token": link["token"],
        "assessment_id": link["assessment_id"],
        "created_at": link["created_at"],
        "expires_at": link.get("expires_at"),
        "view_count": link.get("view_count", 0),
        "last_viewed_at": link.get("last_viewed_at"),
    }


@api_router.get("/shared/{token}")
async def get_shared_briefing(token: str):
    link = await db.share_links.find_one({"token": token}, {"_id": 0})
    if not link or not link.get("is_active"):
        raise HTTPException(status_code=404, detail="Shared briefing not found or no longer available")

    if link.get("expires_at"):
        try:
            expires_dt = datetime.fromisoformat(link["expires_at"])
            if datetime.now(timezone.utc) > expires_dt:
                raise HTTPException(status_code=410, detail="Shared briefing has expired")
        except ValueError:
            pass

    report = await db.reports.find_one({"assessment_id": link["assessment_id"]}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Underlying report no longer exists")

    # Strip transit identifiers (pre-existing security behavior)
    sanitized_report = {k: v for k, v in report.items() if k not in ("id", "assessment_id")}

    await db.share_links.update_one(
        {"token": token},
        {"$inc": {"view_count": 1}, "$set": {"last_viewed_at": _now_iso()}},
    )

    return {
        "token": link["token"],
        "executive_abstract": link.get("executive_abstract"),
        "shared_at": link["created_at"],
        "expires_at": link.get("expires_at"),
        "report": sanitized_report,
    }


# ===== Initiative Routes =====

@api_router.get("/initiatives/{initiative_id}")
async def get_initiative(initiative_id: str):
    """Initiative metadata + ordered assessment history + latest completed + remediation state."""
    initiative = await db.initiatives.find_one({"id": initiative_id}, {"_id": 0})
    if not initiative:
        raise HTTPException(status_code=404, detail="Initiative not found")

    assessments = await db.assessments.find(
        {"initiative_id": initiative_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=200)

    completed = [a for a in assessments if a["status"] == "completed"]
    latest_completed = completed[-1] if completed else None

    plans = await db.remediation_plans.find(
        {"initiative_id": initiative_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=200)

    # Attach action summaries to each plan
    enriched_plans = []
    for plan in plans:
        actions = await db.remediation_actions.find(
            {"plan_id": plan["id"]}, {"_id": 0}
        ).sort("created_at", 1).to_list(length=100)
        plan["actions"] = actions
        enriched_plans.append(plan)

    return {
        "initiative": initiative,
        "assessments": assessments,
        "latest_completed_assessment": latest_completed,
        "remediation_plans": enriched_plans,
    }


@api_router.get("/initiatives/{initiative_id}/assessments")
async def get_initiative_assessments(initiative_id: str):
    """Ordered assessment history for an initiative."""
    initiative = await db.initiatives.find_one({"id": initiative_id}, {"_id": 0})
    if not initiative:
        raise HTTPException(status_code=404, detail="Initiative not found")

    assessments = await db.assessments.find(
        {"initiative_id": initiative_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=200)

    return {"initiative_id": initiative_id, "assessments": assessments}


@api_router.post("/initiatives/{initiative_id}/reassessment")
async def create_reassessment(initiative_id: str):
    """Create a new draft assessment linked to an existing initiative."""
    initiative = await db.initiatives.find_one({"id": initiative_id}, {"_id": 0})
    if not initiative:
        raise HTTPException(status_code=404, detail="Initiative not found")

    snap = Initiative(
        name=initiative.get("name", ""),
        business_unit=initiative.get("business_unit", ""),
        description=initiative.get("description", ""),
        target_workflow=initiative.get("target_workflow", ""),
        expected_outcomes=initiative.get("expected_outcomes", ""),
        stage=initiative.get("stage"),
    )

    doc = _new_assessment_doc(snap, None, initiative_id=initiative_id)
    await db.assessments.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


# ===== Remediation Plan Routes =====

@api_router.post("/initiatives/{initiative_id}/remediation-plans")
async def create_remediation_plan(initiative_id: str, payload: RemediationPlanCreate):
    """Create a remediation plan anchored to a deterministic finding."""
    initiative = await db.initiatives.find_one({"id": initiative_id}, {"_id": 0})
    if not initiative:
        raise HTTPException(status_code=404, detail="Initiative not found")

    # Source assessment must belong to this initiative
    source_assessment = await db.assessments.find_one(
        {"id": payload.source_assessment_id, "initiative_id": initiative_id},
        {"_id": 0},
    )
    if not source_assessment:
        raise HTTPException(
            status_code=404,
            detail="Source assessment not found for this initiative.",
        )

    # Resolve scores for validation (use snapshot if available; compute otherwise)
    scores_for_validation = _get_or_compute_scores(source_assessment)
    finding = payload.source_finding

    if finding.type == "blocker":
        triggered_ids = {b["id"] for b in scores_for_validation.get("triggered_blockers", [])}
        if finding.ref_id not in triggered_ids:
            raise HTTPException(
                status_code=422,
                detail=f"Blocker '{finding.ref_id}' is not a triggered blocker in the source assessment.",
            )
    elif finding.type == "risk":
        # ref_id = dimension id; risk = dimension with score < RISK_THRESHOLD
        risk_dim_ids = {
            d["id"] for d in scores_for_validation.get("dimensions", [])
            if d["score"] < RISK_THRESHOLD
        }
        if finding.ref_id not in risk_dim_ids:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Dimension '{finding.ref_id}' is not a risk in the source assessment "
                    f"(score must be < {RISK_THRESHOLD})."
                ),
            )

    plan_doc = {
        "id": str(uuid.uuid4()),
        "initiative_id": initiative_id,
        "source_assessment_id": payload.source_assessment_id,
        "source_finding": finding.model_dump(),
        "objective": payload.objective,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.remediation_plans.insert_one(plan_doc.copy())
    plan_doc.pop("_id", None)
    return plan_doc


@api_router.get("/initiatives/{initiative_id}/remediation-plans")
async def get_remediation_plans(initiative_id: str):
    """List all remediation plans for an initiative, with actions."""
    initiative = await db.initiatives.find_one({"id": initiative_id}, {"_id": 0})
    if not initiative:
        raise HTTPException(status_code=404, detail="Initiative not found")

    plans = await db.remediation_plans.find(
        {"initiative_id": initiative_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=200)

    result = []
    for plan in plans:
        actions = await db.remediation_actions.find(
            {"plan_id": plan["id"]}, {"_id": 0}
        ).sort("created_at", 1).to_list(length=100)
        plan["actions"] = actions
        result.append(plan)

    return {"initiative_id": initiative_id, "plans": result}


@api_router.get("/remediation-plans/{plan_id}")
async def get_remediation_plan(plan_id: str):
    """Get a single remediation plan with its actions."""
    plan = await db.remediation_plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Remediation plan not found")

    actions = await db.remediation_actions.find(
        {"plan_id": plan_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=100)
    plan["actions"] = actions
    return plan


# ===== Remediation Action Routes =====

@api_router.post("/remediation-plans/{plan_id}/actions")
async def create_action(plan_id: str, payload: RemediationActionCreate):
    """Add a remediation action to a plan."""
    plan = await db.remediation_plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Remediation plan not found")

    action_doc = {
        "id": str(uuid.uuid4()),
        "plan_id": plan_id,
        "description": payload.description,
        "owner": payload.owner or "",
        "target_date": payload.target_date,
        "status": payload.status,
        "evidence_requirement": payload.evidence_requirement or "",
        "evidence_reference": payload.evidence_reference or "",
        "evidence_status": payload.evidence_status,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.remediation_actions.insert_one(action_doc.copy())
    action_doc.pop("_id", None)
    return action_doc


@api_router.patch("/remediation-actions/{action_id}")
async def update_action(action_id: str, patch: RemediationActionPatch):
    """Update a remediation action. Remediation changes never mutate readiness scores."""
    existing = await db.remediation_actions.find_one({"id": action_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Remediation action not found")

    update: Dict[str, Any] = {"updated_at": _now_iso()}
    for field in (
        "description", "owner", "target_date", "status",
        "evidence_requirement", "evidence_reference", "evidence_status",
    ):
        val = getattr(patch, field)
        if val is not None:
            update[field] = val

    await db.remediation_actions.update_one({"id": action_id}, {"$set": update})
    result = await db.remediation_actions.find_one({"id": action_id}, {"_id": 0})
    return result


# ===== Comparison Routes =====

@api_router.get("/initiatives/{initiative_id}/comparison")
async def get_comparison(
    initiative_id: str,
    from_id: str = Query(..., alias="from"),
    to_id: str = Query(..., alias="to"),
):
    """
    Deterministic comparison between two completed assessments.
    D-D: dimension comparison suppressed when ontology versions differ.
    """
    assess_from = await db.assessments.find_one(
        {"id": from_id, "initiative_id": initiative_id}, {"_id": 0}
    )
    assess_to = await db.assessments.find_one(
        {"id": to_id, "initiative_id": initiative_id}, {"_id": 0}
    )

    if not assess_from:
        raise HTTPException(
            status_code=404,
            detail=f"Assessment '{from_id}' not found for this initiative.",
        )
    if not assess_to:
        raise HTTPException(
            status_code=404,
            detail=f"Assessment '{to_id}' not found for this initiative.",
        )
    if assess_from["status"] != "completed":
        raise HTTPException(status_code=409, detail="'from' assessment is not completed.")
    if assess_to["status"] != "completed":
        raise HTTPException(status_code=409, detail="'to' assessment is not completed.")

    snap_from = assess_from.get("score_snapshot")
    snap_to = assess_to.get("score_snapshot")

    if not snap_from:
        raise HTTPException(
            status_code=409,
            detail="'from' assessment lacks a frozen score snapshot. Regenerate the report to freeze it.",
        )
    if not snap_to:
        raise HTTPException(
            status_code=409,
            detail="'to' assessment lacks a frozen score snapshot. Regenerate the report to freeze it.",
        )

    return compare_assessments(snap_from, snap_to, assess_from, assess_to)


@api_router.post("/initiatives/{initiative_id}/comparison/explanation")
async def get_comparison_explanation(
    initiative_id: str,
    payload: ComparisonExplanationRequest,
):
    """AI explanation of assessment comparison. Deterministic fallback on LLM failure."""
    initiative = await db.initiatives.find_one({"id": initiative_id}, {"_id": 0})
    if not initiative:
        raise HTTPException(status_code=404, detail="Initiative not found")

    assess_from = await db.assessments.find_one(
        {"id": payload.from_assessment_id, "initiative_id": initiative_id}, {"_id": 0}
    )
    assess_to = await db.assessments.find_one(
        {"id": payload.to_assessment_id, "initiative_id": initiative_id}, {"_id": 0}
    )

    if not assess_from or not assess_to:
        raise HTTPException(status_code=404, detail="One or both assessments not found for this initiative.")

    snap_from = assess_from.get("score_snapshot")
    snap_to = assess_to.get("score_snapshot")

    if not snap_from or not snap_to:
        raise HTTPException(
            status_code=409,
            detail="Both assessments require frozen score snapshots.",
        )

    comparison = compare_assessments(snap_from, snap_to, assess_from, assess_to)

    # Gather remediation actions for context (between the two assessments)
    plans = await db.remediation_plans.find(
        {"initiative_id": initiative_id, "source_assessment_id": assess_from["id"]},
        {"_id": 0},
    ).to_list(length=50)

    all_actions: List[Dict[str, Any]] = []
    for plan in plans:
        actions = await db.remediation_actions.find(
            {"plan_id": plan["id"]}, {"_id": 0}
        ).sort("created_at", 1).to_list(length=50)
        all_actions.extend(actions)

    explanation = await generate_comparison_explanation(
        initiative=initiative,
        comparison=comparison,
        remediation_actions=all_actions,
        snap_from=snap_from,
        snap_to=snap_to,
    )

    return {"explanation": explanation, "comparison": comparison}


# ---- Mount router & CORS ----
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def ensure_indexes():
    """Idempotently create production indexes on startup."""
    try:
        # Existing indexes
        await db.assessments.create_index("id", unique=True, name="assessments_id_unique")
        await db.reports.create_index("assessment_id", name="reports_assessment_id")
        await db.share_links.create_index("token", unique=True, name="share_links_token_unique")
        await db.share_links.create_index(
            [("assessment_id", 1), ("is_active", 1)],
            name="share_links_assessment_id_is_active",
        )
        # New indexes for Phase 2 collections
        await db.initiatives.create_index("id", unique=True, name="initiatives_id_unique")
        await db.assessments.create_index(
            "initiative_id", name="assessments_initiative_id"
        )
        await db.remediation_plans.create_index(
            "initiative_id", name="remediation_plans_initiative_id"
        )
        await db.remediation_plans.create_index(
            "source_assessment_id", name="remediation_plans_source_assessment_id"
        )
        await db.remediation_actions.create_index(
            "plan_id", name="remediation_actions_plan_id"
        )
        logger.info("MongoDB indexes verified.")
    except Exception as e:
        logger.warning("Index creation skipped (%s). App will still function.", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
