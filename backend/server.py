from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Literal
from datetime import datetime, timezone

from scoring_engine import score_assessment
from reasoning_service import generate_reasoning
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


# ===== Helpers =====
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_assessment_doc(initiative: Optional[Initiative], evidence: Optional[Dict[str, str]]) -> Dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "ontology_version": ONTOLOGY["version"],
        "initiative": (initiative.model_dump() if initiative else Initiative().model_dump()),
        "evidence": evidence or {},
        "status": "draft",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "completed_at": None,
    }


async def _get_assessment(assessment_id: str) -> Dict[str, Any]:
    doc = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return doc


# ===== Routes =====
@api_router.get("/health")
async def health():
    return {"status": "ok", "ontology_version": ONTOLOGY["version"]}


@api_router.get("/ontology")
async def get_ontology():
    """Return the active ontology so the frontend can render the assessment UI."""
    return ONTOLOGY


@api_router.post("/assessments")
async def create_assessment(payload: AssessmentCreate):
    doc = _new_assessment_doc(payload.initiative, payload.evidence)
    await db.assessments.insert_one(doc.copy())
    return doc


@api_router.get("/assessments/{assessment_id}")
async def get_assessment(assessment_id: str):
    return await _get_assessment(assessment_id)


@api_router.patch("/assessments/{assessment_id}")
async def patch_assessment(assessment_id: str, patch: AssessmentPatch):
    existing = await _get_assessment(assessment_id)

    update: Dict[str, Any] = {"updated_at": _now_iso()}

    if patch.initiative is not None:
        merged = {**existing["initiative"], **patch.initiative.model_dump(exclude_unset=True)}
        update["initiative"] = merged

    if patch.evidence is not None:
        # Merge evidence (partial updates)
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
    """Run deterministic scoring (no LLM). Useful for live 'Readiness Pulse'."""
    doc = await _get_assessment(assessment_id)
    result = score_assessment(doc.get("evidence", {}), ONTOLOGY)
    return result


@api_router.post("/assessments/{assessment_id}/report")
async def generate_report(assessment_id: str):
    """Compute scores + generate LLM reasoning, persist as report, return it."""
    doc = await _get_assessment(assessment_id)
    scores = score_assessment(doc.get("evidence", {}), ONTOLOGY)
    reasoning = await generate_reasoning(doc["initiative"], scores)

    report = {
        "id": str(uuid.uuid4()),
        "assessment_id": assessment_id,
        "ontology_version": ONTOLOGY["version"],
        "initiative": doc["initiative"],
        "scores": scores,
        "reasoning": reasoning,
        "generated_at": _now_iso(),
    }

    # Persist (replace any prior report for this assessment)
    await db.reports.delete_many({"assessment_id": assessment_id})
    await db.reports.insert_one(report.copy())

    # Mark assessment completed
    await db.assessments.update_one(
        {"id": assessment_id},
        {"$set": {"status": "completed", "completed_at": _now_iso(), "updated_at": _now_iso()}},
    )

    # Strip _id (defensive) before returning
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

    # Replace existing demo if present
    await db.assessments.delete_many({"is_demo": True})
    await db.assessments.insert_one(doc.copy())

    # Compute and store report
    scores = score_assessment(doc["evidence"], ONTOLOGY)
    reasoning = await generate_reasoning(doc["initiative"], scores)
    report = {
        "id": str(uuid.uuid4()),
        "assessment_id": doc["id"],
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
    # Lazy seed
    seeded = await seed_demo()
    return {"assessment_id": seeded["assessment_id"]}


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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
