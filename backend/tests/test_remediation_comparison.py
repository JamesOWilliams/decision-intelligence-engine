"""
DIE Orbit — Remediation + Reassessment + Comparison test suite.

Covers:
- Initiative / History
- Assessment Immutability
- Remediation Plans
- Remediation Actions
- Reassessment
- Deterministic Comparison
- AI Evals (Scenarios A–E)
- Regression (smoke)
"""
import os
import time
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://decision-intel-26.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

DEFAULT_TIMEOUT = 30
LLM_TIMEOUT = 90


# ───────────────────────────── Fixtures ─────────────────────────────

@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_initiative_data():
    """Import demo data from the module (import works because tests run from backend dir)."""
    from demo_seed import DEMO_INITIATIVE, DEMO_EVIDENCE
    return DEMO_INITIATIVE, DEMO_EVIDENCE


@pytest.fixture
def fresh_assessment(session):
    r = session.post(f"{API}/assessments", json={}, timeout=DEFAULT_TIMEOUT)
    assert r.status_code == 200, r.text
    return r.json()


def _make_completed_assessment(session, initiative, evidence):
    """Helper: create, patch, and complete (generate report) an assessment. Returns (assessment, report)."""
    a = session.post(f"{API}/assessments", json={}, timeout=DEFAULT_TIMEOUT).json()
    aid = a["id"]
    session.patch(
        f"{API}/assessments/{aid}",
        json={"initiative": initiative, "evidence": evidence},
        timeout=DEFAULT_TIMEOUT,
    )
    r = session.post(f"{API}/assessments/{aid}/report", timeout=LLM_TIMEOUT)
    assert r.status_code == 200, r.text
    report = r.json()
    assessment = session.get(f"{API}/assessments/{aid}", timeout=DEFAULT_TIMEOUT).json()
    return assessment, report


# ───────────────────── Initiative / History ─────────────────────────

class TestInitiativeLifecycle:
    def test_assessment_has_initiative_id_after_report(self, session, demo_initiative_data):
        """After generate_report, assessment must carry a durable initiative_id."""
        initiative, evidence = demo_initiative_data
        assessment, report = _make_completed_assessment(session, initiative, evidence)
        assert assessment.get("initiative_id"), "initiative_id must be set after report generation"

    def test_initiative_document_exists(self, session, demo_initiative_data):
        """The durable initiative document must exist and be retrievable."""
        initiative, evidence = demo_initiative_data
        assessment, _ = _make_completed_assessment(session, initiative, evidence)
        initiative_id = assessment["initiative_id"]

        r = session.get(f"{API}/initiatives/{initiative_id}", timeout=DEFAULT_TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["initiative"]["id"] == initiative_id
        assert isinstance(data["assessments"], list)
        assert len(data["assessments"]) >= 1

    def test_initiative_supports_multiple_assessments(self, session, demo_initiative_data):
        """An initiative can have multiple assessments."""
        initiative, evidence = demo_initiative_data
        # First assessment
        assessment1, _ = _make_completed_assessment(session, initiative, evidence)
        initiative_id = assessment1["initiative_id"]

        # Reassess from same initiative
        r = session.post(f"{API}/initiatives/{initiative_id}/reassessment", timeout=DEFAULT_TIMEOUT)
        assert r.status_code == 200, r.text
        assessment2 = r.json()
        assert assessment2["initiative_id"] == initiative_id
        assert assessment2["id"] != assessment1["id"]

        # History should contain at least 2
        r2 = session.get(f"{API}/initiatives/{initiative_id}/assessments", timeout=DEFAULT_TIMEOUT)
        assert r2.status_code == 200
        history = r2.json()["assessments"]
        ids = [a["id"] for a in history]
        assert assessment1["id"] in ids
        assert assessment2["id"] in ids

    def test_assessment_history_ordering(self, session, demo_initiative_data):
        """Assessment history must be ordered chronologically (ascending)."""
        initiative, evidence = demo_initiative_data
        assessment, _ = _make_completed_assessment(session, initiative, evidence)
        initiative_id = assessment["initiative_id"]

        # Create a second assessment
        session.post(f"{API}/initiatives/{initiative_id}/reassessment", timeout=DEFAULT_TIMEOUT)

        r = session.get(f"{API}/initiatives/{initiative_id}/assessments", timeout=DEFAULT_TIMEOUT)
        history = r.json()["assessments"]
        timestamps = [a["created_at"] for a in history]
        assert timestamps == sorted(timestamps), "History must be in ascending created_at order"

    def test_latest_completed_assessment_resolution(self, session, demo_initiative_data):
        """latest_completed_assessment must resolve to the most recently completed one."""
        initiative, evidence = demo_initiative_data
        assessment, _ = _make_completed_assessment(session, initiative, evidence)
        initiative_id = assessment["initiative_id"]

        r = session.get(f"{API}/initiatives/{initiative_id}", timeout=DEFAULT_TIMEOUT)
        data = r.json()
        latest = data["latest_completed_assessment"]
        assert latest is not None
        assert latest["status"] == "completed"
        assert latest["id"] == assessment["id"] or latest["created_at"] >= assessment["created_at"]


# ───────────────────── Immutability ─────────────────────────────────

class TestAssessmentImmutability:
    def test_completed_evidence_patch_rejected(self, session, demo_initiative_data):
        """PATCH evidence on a completed assessment must return 409."""
        initiative, evidence = demo_initiative_data
        assessment, _ = _make_completed_assessment(session, initiative, evidence)
        aid = assessment["id"]

        r = session.patch(
            f"{API}/assessments/{aid}",
            json={"evidence": {"rollout_plan_documented": "drafted"}},
            timeout=DEFAULT_TIMEOUT,
        )
        assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"

    def test_completed_initiative_patch_rejected(self, session, demo_initiative_data):
        """PATCH initiative on a completed assessment must return 409."""
        initiative, evidence = demo_initiative_data
        assessment, _ = _make_completed_assessment(session, initiative, evidence)
        aid = assessment["id"]

        r = session.patch(
            f"{API}/assessments/{aid}",
            json={"initiative": {"name": "Tampered Name"}},
            timeout=DEFAULT_TIMEOUT,
        )
        assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"

    def test_draft_assessment_remains_editable(self, session, fresh_assessment):
        """Draft assessments must remain editable."""
        aid = fresh_assessment["id"]
        r = session.patch(
            f"{API}/assessments/{aid}",
            json={"evidence": {"rollout_plan_documented": "drafted"}},
            timeout=DEFAULT_TIMEOUT,
        )
        assert r.status_code == 200

    def test_score_snapshot_frozen_on_first_report(self, session, demo_initiative_data):
        """score_snapshot on assessment must be set and not overwritten on re-generation."""
        initiative, evidence = demo_initiative_data
        a = session.post(f"{API}/assessments", json={}, timeout=DEFAULT_TIMEOUT).json()
        aid = a["id"]
        session.patch(
            f"{API}/assessments/{aid}",
            json={"initiative": initiative, "evidence": evidence},
            timeout=DEFAULT_TIMEOUT,
        )

        # Generate first report
        session.post(f"{API}/assessments/{aid}/report", timeout=LLM_TIMEOUT)
        a1 = session.get(f"{API}/assessments/{aid}", timeout=DEFAULT_TIMEOUT).json()
        snap1 = a1.get("score_snapshot")
        scored_at_1 = a1.get("scored_at")
        assert snap1 is not None, "score_snapshot must be set after report generation"
        assert scored_at_1 is not None, "scored_at must be set after report generation"

        # Regenerate report — snapshot must not change
        session.post(f"{API}/assessments/{aid}/report", timeout=LLM_TIMEOUT)
        a2 = session.get(f"{API}/assessments/{aid}", timeout=DEFAULT_TIMEOUT).json()
        assert a2["score_snapshot"]["domain_score"] == snap1["domain_score"]
        assert a2["scored_at"] == scored_at_1, "scored_at must not change on re-generation"

    def test_score_snapshot_not_overwritten_by_narrative_regeneration(self, session, demo_initiative_data):
        """Narrative regeneration may replace reasoning but must not alter frozen score truth."""
        initiative, evidence = demo_initiative_data
        assessment, _ = _make_completed_assessment(session, initiative, evidence)
        aid = assessment["id"]

        snap_before = session.get(f"{API}/assessments/{aid}", timeout=DEFAULT_TIMEOUT).json()["score_snapshot"]
        assert snap_before is not None

        # Regenerate narrative
        session.post(f"{API}/assessments/{aid}/report", timeout=LLM_TIMEOUT)

        snap_after = session.get(f"{API}/assessments/{aid}", timeout=DEFAULT_TIMEOUT).json()["score_snapshot"]
        assert snap_after["domain_score"] == snap_before["domain_score"]
        assert snap_after["maturity_band"] == snap_before["maturity_band"]


# ───────────────────── Remediation Plans ────────────────────────────

class TestRemediationPlans:
    def test_create_blocker_remediation_plan(self, session, demo_initiative_data):
        """Create a remediation plan anchored to a deterministic blocker."""
        from demo_seed import DEMO_EVIDENCE
        # Use evidence that triggers at least one blocker
        blocker_evidence = {k: "not_started" for k in DEMO_EVIDENCE}
        blocker_evidence["executive_sponsor_identified"] = "approved"

        a = session.post(f"{API}/assessments", json={}, timeout=DEFAULT_TIMEOUT).json()
        aid = a["id"]
        session.patch(
            f"{API}/assessments/{aid}",
            json={"evidence": blocker_evidence},
            timeout=DEFAULT_TIMEOUT,
        )
        session.post(f"{API}/assessments/{aid}/report", timeout=LLM_TIMEOUT)
        assessment = session.get(f"{API}/assessments/{aid}", timeout=DEFAULT_TIMEOUT).json()
        initiative_id = assessment["initiative_id"]

        # Find a triggered blocker id
        snap = assessment["score_snapshot"]
        triggered = snap.get("triggered_blockers", [])
        assert len(triggered) > 0, "Need at least one triggered blocker for this test"
        blocker = triggered[0]

        r = session.post(
            f"{API}/initiatives/{initiative_id}/remediation-plans",
            json={
                "source_assessment_id": aid,
                "source_finding": {
                    "type": "blocker",
                    "ref_id": blocker["id"],
                    "label": blocker["label"],
                    "captured_score": snap["domain_score"],
                    "captured_band": snap["maturity_band"],
                },
                "objective": "Formally assign a business owner.",
            },
            timeout=DEFAULT_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        plan = r.json()
        assert plan["source_finding"]["type"] == "blocker"
        assert plan["source_finding"]["ref_id"] == blocker["id"]
        assert plan["initiative_id"] == initiative_id

    def test_create_risk_remediation_plan(self, session, demo_initiative_data):
        """Create a remediation plan anchored to a risk dimension."""
        initiative, evidence = demo_initiative_data
        assessment, _ = _make_completed_assessment(session, initiative, evidence)
        initiative_id = assessment["initiative_id"]

        snap = assessment["score_snapshot"]
        risks = snap.get("risks", [])
        assert len(risks) > 0, "Demo evidence must produce at least one risk dimension"

        # Get the dimension id from the full dimension list
        risk_name = risks[0]["dimension"]
        dim_id = next(
            d["id"] for d in snap["dimensions"] if d["name"] == risk_name
        )

        r = session.post(
            f"{API}/initiatives/{initiative_id}/remediation-plans",
            json={
                "source_assessment_id": assessment["id"],
                "source_finding": {
                    "type": "risk",
                    "ref_id": dim_id,
                    "label": risk_name,
                    "captured_score": risks[0]["score"],
                    "captured_band": risks[0]["band"],
                },
                "objective": f"Address gaps in {risk_name}.",
            },
            timeout=DEFAULT_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        plan = r.json()
        assert plan["source_finding"]["type"] == "risk"
        assert plan["source_finding"]["ref_id"] == dim_id

    def test_invalid_blocker_ref_rejected(self, session, demo_initiative_data):
        """Creating a plan with a non-existent blocker id must return 422."""
        initiative, evidence = demo_initiative_data
        assessment, _ = _make_completed_assessment(session, initiative, evidence)
        initiative_id = assessment["initiative_id"]

        r = session.post(
            f"{API}/initiatives/{initiative_id}/remediation-plans",
            json={
                "source_assessment_id": assessment["id"],
                "source_finding": {
                    "type": "blocker",
                    "ref_id": "nonexistent_blocker_xyz",
                    "label": "fake",
                },
                "objective": "Should fail.",
            },
            timeout=DEFAULT_TIMEOUT,
        )
        assert r.status_code == 422, f"Expected 422, got {r.status_code}"

    def test_source_finding_ref_persists(self, session, demo_initiative_data):
        """The source finding reference must persist correctly in the plan."""
        initiative, evidence = demo_initiative_data
        assessment, _ = _make_completed_assessment(session, initiative, evidence)
        initiative_id = assessment["initiative_id"]

        snap = assessment["score_snapshot"]
        risks = snap.get("risks", [])
        assert risks
        risk_name = risks[0]["dimension"]
        dim_id = next(d["id"] for d in snap["dimensions"] if d["name"] == risk_name)

        r = session.post(
            f"{API}/initiatives/{initiative_id}/remediation-plans",
            json={
                "source_assessment_id": assessment["id"],
                "source_finding": {
                    "type": "risk",
                    "ref_id": dim_id,
                    "label": risk_name,
                    "captured_score": risks[0]["score"],
                    "captured_band": risks[0]["band"],
                },
                "objective": "Persistence check.",
            },
            timeout=DEFAULT_TIMEOUT,
        )
        plan = r.json()

        # Re-fetch plan
        r2 = session.get(f"{API}/remediation-plans/{plan['id']}", timeout=DEFAULT_TIMEOUT)
        assert r2.status_code == 200
        fetched = r2.json()
        assert fetched["source_finding"]["ref_id"] == dim_id
        assert fetched["source_finding"]["captured_score"] == risks[0]["score"]


# ───────────────────── Remediation Actions ──────────────────────────

@pytest.fixture(scope="module")
def plan_with_initiative(session):
    """Create an initiative, complete an assessment, create a risk plan. Returns (initiative_id, plan)."""
    from demo_seed import DEMO_INITIATIVE, DEMO_EVIDENCE
    assessment, _ = _make_completed_assessment(session, DEMO_INITIATIVE, DEMO_EVIDENCE)
    initiative_id = assessment["initiative_id"]
    snap = assessment["score_snapshot"]
    risks = snap.get("risks", [])
    assert risks, "Demo evidence must have at least one risk"
    risk_name = risks[0]["dimension"]
    dim_id = next(d["id"] for d in snap["dimensions"] if d["name"] == risk_name)

    r = session.post(
        f"{API}/initiatives/{initiative_id}/remediation-plans",
        json={
            "source_assessment_id": assessment["id"],
            "source_finding": {"type": "risk", "ref_id": dim_id, "label": risk_name},
            "objective": "Module-scoped plan fixture.",
        },
        timeout=DEFAULT_TIMEOUT,
    )
    assert r.status_code == 200, r.text
    return initiative_id, r.json()


class TestRemediationActions:
    def test_create_action(self, session, plan_with_initiative):
        _, plan = plan_with_initiative
        r = session.post(
            f"{API}/remediation-plans/{plan['id']}/actions",
            json={
                "description": "Assign named business owner",
                "owner": "Jane Smith",
                "target_date": "2026-09-30",
                "status": "not_started",
                "evidence_requirement": "Signed appointment letter",
                "evidence_reference": "",
                "evidence_status": "not_provided",
            },
            timeout=DEFAULT_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        action = r.json()
        assert action["description"] == "Assign named business owner"
        assert action["owner"] == "Jane Smith"
        assert action["status"] == "not_started"
        assert action["evidence_status"] == "not_provided"

    def test_multiple_actions_supported(self, session, plan_with_initiative):
        _, plan = plan_with_initiative
        for i in range(3):
            session.post(
                f"{API}/remediation-plans/{plan['id']}/actions",
                json={"description": f"Action {i+1}"},
                timeout=DEFAULT_TIMEOUT,
            )
        r = session.get(f"{API}/remediation-plans/{plan['id']}", timeout=DEFAULT_TIMEOUT)
        assert len(r.json()["actions"]) >= 3

    def test_action_status_persists(self, session, plan_with_initiative):
        _, plan = plan_with_initiative
        r = session.post(
            f"{API}/remediation-plans/{plan['id']}/actions",
            json={"description": "Status test action", "status": "in_progress"},
            timeout=DEFAULT_TIMEOUT,
        )
        action_id = r.json()["id"]

        # Update status
        r2 = session.patch(
            f"{API}/remediation-actions/{action_id}",
            json={"status": "complete"},
            timeout=DEFAULT_TIMEOUT,
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "complete"

    def test_owner_date_persist(self, session, plan_with_initiative):
        _, plan = plan_with_initiative
        r = session.post(
            f"{API}/remediation-plans/{plan['id']}/actions",
            json={"description": "Owner test", "owner": "Bob Jones", "target_date": "2026-12-31"},
            timeout=DEFAULT_TIMEOUT,
        )
        action_id = r.json()["id"]

        fetched = session.get(f"{API}/remediation-plans/{plan['id']}", timeout=DEFAULT_TIMEOUT).json()
        actions = {a["id"]: a for a in fetched["actions"]}
        assert actions[action_id]["owner"] == "Bob Jones"
        assert actions[action_id]["target_date"] == "2026-12-31"

    def test_evidence_fields_persist(self, session, plan_with_initiative):
        _, plan = plan_with_initiative
        r = session.post(
            f"{API}/remediation-plans/{plan['id']}/actions",
            json={
                "description": "Evidence test",
                "evidence_requirement": "Formal approval email",
                "evidence_reference": "https://example.com/approval.pdf",
                "evidence_status": "provided",
            },
            timeout=DEFAULT_TIMEOUT,
        )
        action = r.json()
        assert action["evidence_requirement"] == "Formal approval email"
        assert action["evidence_reference"] == "https://example.com/approval.pdf"
        assert action["evidence_status"] == "provided"

    def test_remediation_changes_never_mutate_readiness_score(self, session, plan_with_initiative):
        """INV-002: remediation actions must not alter readiness scores."""
        initiative_id, plan = plan_with_initiative

        # Get initiative to find the source assessment
        r = session.get(f"{API}/initiatives/{initiative_id}", timeout=DEFAULT_TIMEOUT)
        latest = r.json()["latest_completed_assessment"]
        snap_before = latest["score_snapshot"]

        # Add and complete an action
        action_r = session.post(
            f"{API}/remediation-plans/{plan['id']}/actions",
            json={"description": "Score mutation test", "status": "not_started"},
            timeout=DEFAULT_TIMEOUT,
        )
        action_id = action_r.json()["id"]
        session.patch(
            f"{API}/remediation-actions/{action_id}",
            json={"status": "complete", "evidence_status": "provided"},
            timeout=DEFAULT_TIMEOUT,
        )

        # Score must be unchanged
        r2 = session.get(f"{API}/initiatives/{initiative_id}", timeout=DEFAULT_TIMEOUT)
        latest2 = r2.json()["latest_completed_assessment"]
        assert latest2["score_snapshot"]["domain_score"] == snap_before["domain_score"], (
            "Readiness score must not be mutated by remediation actions"
        )


# ───────────────────── Reassessment ─────────────────────────────────

class TestReassessment:
    def test_reassessment_creates_new_uuid(self, session, demo_initiative_data):
        initiative, evidence = demo_initiative_data
        assessment, _ = _make_completed_assessment(session, initiative, evidence)
        initiative_id = assessment["initiative_id"]

        r = session.post(f"{API}/initiatives/{initiative_id}/reassessment", timeout=DEFAULT_TIMEOUT)
        assert r.status_code == 200
        reassessment = r.json()
        assert reassessment["id"] != assessment["id"]
        assert len(reassessment["id"]) >= 32

    def test_reassessment_links_correct_initiative(self, session, demo_initiative_data):
        initiative, evidence = demo_initiative_data
        assessment, _ = _make_completed_assessment(session, initiative, evidence)
        initiative_id = assessment["initiative_id"]

        r = session.post(f"{API}/initiatives/{initiative_id}/reassessment", timeout=DEFAULT_TIMEOUT)
        reassessment = r.json()
        assert reassessment["initiative_id"] == initiative_id

    def test_original_assessment_unchanged_after_reassessment(self, session, demo_initiative_data):
        initiative, evidence = demo_initiative_data
        assessment, _ = _make_completed_assessment(session, initiative, evidence)
        initiative_id = assessment["initiative_id"]
        original_id = assessment["id"]
        original_snap = assessment["score_snapshot"]

        session.post(f"{API}/initiatives/{initiative_id}/reassessment", timeout=DEFAULT_TIMEOUT)

        # Original must be untouched
        original_after = session.get(f"{API}/assessments/{original_id}", timeout=DEFAULT_TIMEOUT).json()
        assert original_after["status"] == "completed"
        assert original_after["score_snapshot"]["domain_score"] == original_snap["domain_score"]

    def test_reassessment_uses_existing_scoring_engine(self, session, demo_initiative_data):
        """Reassessment must use the deterministic scoring engine unchanged."""
        initiative, evidence = demo_initiative_data
        assessment, _ = _make_completed_assessment(session, initiative, evidence)
        initiative_id = assessment["initiative_id"]

        r2 = session.post(f"{API}/initiatives/{initiative_id}/reassessment", timeout=DEFAULT_TIMEOUT)
        reassessment = r2.json()
        new_aid = reassessment["id"]

        # Patch with same evidence
        session.patch(
            f"{API}/assessments/{new_aid}",
            json={"evidence": evidence},
            timeout=DEFAULT_TIMEOUT,
        )
        score_r = session.post(f"{API}/assessments/{new_aid}/score", timeout=DEFAULT_TIMEOUT)
        assert score_r.status_code == 200
        new_scores = score_r.json()
        assert new_scores["domain_score"] == assessment["score_snapshot"]["domain_score"]


# ───────────────────── Comparison ───────────────────────────────────

@pytest.fixture(scope="module")
def two_completed_assessments(session):
    """Create an initiative with two completed assessments. Returns (initiative_id, a1, a2)."""
    from demo_seed import DEMO_INITIATIVE, DEMO_EVIDENCE

    # Assessment 1 — demo evidence
    a1, _ = _make_completed_assessment(session, DEMO_INITIATIVE, DEMO_EVIDENCE)
    initiative_id = a1["initiative_id"]

    # Assessment 2 — slightly weaker evidence via reassessment
    r = session.post(f"{API}/initiatives/{initiative_id}/reassessment", timeout=DEFAULT_TIMEOUT)
    a2_draft = r.json()

    # Use partial evidence for lower score
    partial_evidence = {k: "informal" for k in DEMO_EVIDENCE}
    session.patch(
        f"{API}/assessments/{a2_draft['id']}",
        json={"evidence": partial_evidence},
        timeout=DEFAULT_TIMEOUT,
    )
    session.post(f"{API}/assessments/{a2_draft['id']}/report", timeout=LLM_TIMEOUT)
    a2 = session.get(f"{API}/assessments/{a2_draft['id']}", timeout=DEFAULT_TIMEOUT).json()
    return initiative_id, a1, a2


class TestDeterministicComparison:
    def test_overall_delta_correct(self, session, two_completed_assessments):
        initiative_id, a1, a2 = two_completed_assessments
        r = session.get(
            f"{API}/initiatives/{initiative_id}/comparison",
            params={"from": a1["id"], "to": a2["id"]},
            timeout=DEFAULT_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        comp = r.json()
        expected_delta = (
            a2["score_snapshot"]["domain_score"] - a1["score_snapshot"]["domain_score"]
        )
        assert comp["overall"]["delta"] == expected_delta

    def test_dimension_delta_correct(self, session, two_completed_assessments):
        initiative_id, a1, a2 = two_completed_assessments
        r = session.get(
            f"{API}/initiatives/{initiative_id}/comparison",
            params={"from": a1["id"], "to": a2["id"]},
            timeout=DEFAULT_TIMEOUT,
        )
        comp = r.json()
        if not comp["dimensions_comparable"]:
            pytest.skip("Ontology versions differ; dimension comparison not applicable")

        a1_dims = {d["id"]: d for d in a1["score_snapshot"]["dimensions"]}
        a2_dims = {d["id"]: d for d in a2["score_snapshot"]["dimensions"]}

        for dim in comp["dimensions"]:
            did = dim["id"]
            expected = a2_dims[did]["score"] - a1_dims[did]["score"]
            assert dim["delta"] == expected, f"Dimension {did}: expected delta {expected}, got {dim['delta']}"

    def test_maturity_transition_correct(self, session, two_completed_assessments):
        initiative_id, a1, a2 = two_completed_assessments
        r = session.get(
            f"{API}/initiatives/{initiative_id}/comparison",
            params={"from": a1["id"], "to": a2["id"]},
            timeout=DEFAULT_TIMEOUT,
        )
        comp = r.json()
        prev_band = a1["score_snapshot"]["maturity_band"]
        curr_band = a2["score_snapshot"]["maturity_band"]
        if prev_band != curr_band:
            assert comp["overall"]["maturity_transition"] == f"{prev_band} → {curr_band}"
        else:
            assert comp["overall"]["maturity_transition"] is None

    def test_both_assessments_must_be_completed(self, session, demo_initiative_data):
        initiative, evidence = demo_initiative_data
        a1, _ = _make_completed_assessment(session, initiative, evidence)
        initiative_id = a1["initiative_id"]

        # Create a draft reassessment (not completed)
        r_draft = session.post(
            f"{API}/initiatives/{initiative_id}/reassessment", timeout=DEFAULT_TIMEOUT
        )
        draft_id = r_draft.json()["id"]

        r = session.get(
            f"{API}/initiatives/{initiative_id}/comparison",
            params={"from": a1["id"], "to": draft_id},
            timeout=DEFAULT_TIMEOUT,
        )
        assert r.status_code == 409, f"Expected 409 for incomplete assessment, got {r.status_code}"

    def test_same_initiative_required(self, session, demo_initiative_data):
        """Cannot compare assessments from different initiatives."""
        initiative, evidence = demo_initiative_data
        a1, _ = _make_completed_assessment(session, initiative, evidence)
        a2, _ = _make_completed_assessment(session, initiative, evidence)

        # Use a1's initiative_id but a2 belongs to a different initiative
        r = session.get(
            f"{API}/initiatives/{a1['initiative_id']}/comparison",
            params={"from": a1["id"], "to": a2["id"]},
            timeout=DEFAULT_TIMEOUT,
        )
        assert r.status_code == 404, (
            f"Expected 404 when 'to' assessment doesn't belong to initiative, got {r.status_code}"
        )

    def test_cross_version_overall_comparison_works(self, session, two_completed_assessments):
        """Overall comparison must always succeed (D-D)."""
        initiative_id, a1, a2 = two_completed_assessments
        r = session.get(
            f"{API}/initiatives/{initiative_id}/comparison",
            params={"from": a1["id"], "to": a2["id"]},
            timeout=DEFAULT_TIMEOUT,
        )
        assert r.status_code == 200
        assert "overall" in r.json()

    def test_cross_version_dimension_comparison_suppressed(self, session, two_completed_assessments):
        """When ontology versions differ, dimensions_comparable must be False."""
        initiative_id, a1, a2 = two_completed_assessments
        r = session.get(
            f"{API}/initiatives/{initiative_id}/comparison",
            params={"from": a1["id"], "to": a2["id"]},
            timeout=DEFAULT_TIMEOUT,
        )
        comp = r.json()
        if a1["ontology_version"] != a2["ontology_version"]:
            assert comp["dimensions_comparable"] is False
            assert comp["dimensions"] == [], "Dimension deltas must be empty for cross-version comparison"
        else:
            # Same version — dimensions must be present
            assert comp["dimensions_comparable"] is True


# ───────────────────── AI Evals ─────────────────────────────────────

class TestAIEvals:
    """
    Bounded AI evaluation scenarios.
    Tests executed against live LLM — grounding, fidelity, causal restraint.
    """

    def _run_explanation(self, session, a1, a2, initiative_id):
        r = session.post(
            f"{API}/initiatives/{initiative_id}/comparison/explanation",
            json={"from_assessment_id": a1["id"], "to_assessment_id": a2["id"]},
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        return r.json()

    def test_eval_scenario_a_material_improvement(self, session):
        """
        Scenario A: Material Improvement
        Previous: lower score / band
        Current:  higher score / band
        Expected: identifies improvement; avoids causal claim.
        """
        from demo_seed import DEMO_INITIATIVE, DEMO_EVIDENCE

        # Low-evidence assessment (lower score)
        minimal_evidence = {k: "informal" for k in DEMO_EVIDENCE}
        a1, _ = _make_completed_assessment(session, DEMO_INITIATIVE, minimal_evidence)
        initiative_id = a1["initiative_id"]

        # High-evidence reassessment
        r = session.post(f"{API}/initiatives/{initiative_id}/reassessment", timeout=DEFAULT_TIMEOUT)
        a2_draft = r.json()
        session.patch(
            f"{API}/assessments/{a2_draft['id']}",
            json={"evidence": DEMO_EVIDENCE},
            timeout=DEFAULT_TIMEOUT,
        )
        session.post(f"{API}/assessments/{a2_draft['id']}/report", timeout=LLM_TIMEOUT)
        a2 = session.get(f"{API}/assessments/{a2_draft['id']}", timeout=DEFAULT_TIMEOUT).json()

        if a2["score_snapshot"]["domain_score"] <= a1["score_snapshot"]["domain_score"]:
            pytest.skip("Evidence did not produce an improvement for Scenario A")

        result = self._run_explanation(session, a1, a2, initiative_id)
        explanation = result["explanation"]

        # Groundedness: summary must reference score movement
        summary = explanation["summary"].lower()
        assert any(
            word in summary for word in ["improve", "increase", "higher", "progress", "advance"]
        ), f"Scenario A: summary must describe improvement. Got: {explanation['summary']}"

        # Causal restraint: must not claim causation
        full_text = " ".join([
            explanation["summary"],
            *explanation.get("material_changes", []),
        ]).lower()
        forbidden = ["this remediation caused", "action x produced", "caused the score"]
        for phrase in forbidden:
            assert phrase not in full_text, f"Causal claim found: '{phrase}'"

    def test_eval_scenario_b_no_material_movement(self, session):
        """
        Scenario B: No Material Movement
        Same evidence both assessments.
        Expected: accurately communicates limited/no change.
        """
        from demo_seed import DEMO_INITIATIVE, DEMO_EVIDENCE

        a1, _ = _make_completed_assessment(session, DEMO_INITIATIVE, DEMO_EVIDENCE)
        initiative_id = a1["initiative_id"]

        r = session.post(f"{API}/initiatives/{initiative_id}/reassessment", timeout=DEFAULT_TIMEOUT)
        a2_draft = r.json()
        session.patch(
            f"{API}/assessments/{a2_draft['id']}",
            json={"evidence": DEMO_EVIDENCE},
            timeout=DEFAULT_TIMEOUT,
        )
        session.post(f"{API}/assessments/{a2_draft['id']}/report", timeout=LLM_TIMEOUT)
        a2 = session.get(f"{API}/assessments/{a2_draft['id']}", timeout=DEFAULT_TIMEOUT).json()

        result = self._run_explanation(session, a1, a2, initiative_id)
        explanation = result["explanation"]
        comp = result["comparison"]

        # If no delta, explanation must not manufacture progress
        if comp["overall"]["delta"] == 0:
            summary_lower = explanation["summary"].lower()
            false_progress = ["significant improvement", "major advance", "substantial progress"]
            for phrase in false_progress:
                assert phrase not in summary_lower, (
                    f"Scenario B: model manufactured progress. Found '{phrase}' in summary."
                )

    def test_eval_scenario_c_decline(self, session):
        """
        Scenario C: Decline
        Expected: identifies decline; avoids false positivity.
        """
        from demo_seed import DEMO_INITIATIVE, DEMO_EVIDENCE

        a1, _ = _make_completed_assessment(session, DEMO_INITIATIVE, DEMO_EVIDENCE)
        initiative_id = a1["initiative_id"]

        r = session.post(f"{API}/initiatives/{initiative_id}/reassessment", timeout=DEFAULT_TIMEOUT)
        a2_draft = r.json()
        declined_evidence = {k: "informal" for k in DEMO_EVIDENCE}
        session.patch(
            f"{API}/assessments/{a2_draft['id']}",
            json={"evidence": declined_evidence},
            timeout=DEFAULT_TIMEOUT,
        )
        session.post(f"{API}/assessments/{a2_draft['id']}/report", timeout=LLM_TIMEOUT)
        a2 = session.get(f"{API}/assessments/{a2_draft['id']}", timeout=DEFAULT_TIMEOUT).json()

        if a2["score_snapshot"]["domain_score"] >= a1["score_snapshot"]["domain_score"]:
            pytest.skip("Evidence did not produce a decline for Scenario C")

        result = self._run_explanation(session, a1, a2, initiative_id)
        explanation = result["explanation"]
        summary_lower = explanation["summary"].lower()

        assert any(
            word in summary_lower for word in ["decline", "decrease", "lower", "weaken", "reduc"]
        ), f"Scenario C: summary must describe decline. Got: {explanation['summary']}"

        false_positive_phrases = ["strong improvement", "significant progress", "material advance"]
        for phrase in false_positive_phrases:
            assert phrase not in summary_lower, (
                f"Scenario C: false positivity detected. Found '{phrase}'."
            )

    def test_eval_scenario_d_completed_action_without_evidence(self, session):
        """
        Scenario D: Completed action without evidence.
        Expected: distinguishes task completion from demonstrated evidence.
        """
        from demo_seed import DEMO_INITIATIVE, DEMO_EVIDENCE

        a1, _ = _make_completed_assessment(session, DEMO_INITIATIVE, DEMO_EVIDENCE)
        initiative_id = a1["initiative_id"]
        snap = a1["score_snapshot"]
        risks = snap.get("risks", [])
        assert risks, "Need at least one risk dimension"
        risk_name = risks[0]["dimension"]
        dim_id = next(d["id"] for d in snap["dimensions"] if d["name"] == risk_name)

        # Create a plan and mark an action complete but without evidence
        plan_r = session.post(
            f"{API}/initiatives/{initiative_id}/remediation-plans",
            json={
                "source_assessment_id": a1["id"],
                "source_finding": {"type": "risk", "ref_id": dim_id, "label": risk_name},
                "objective": "Address training gap",
            },
            timeout=DEFAULT_TIMEOUT,
        )
        plan_id = plan_r.json()["id"]
        action_r = session.post(
            f"{API}/remediation-plans/{plan_id}/actions",
            json={"description": "Completed without evidence", "status": "not_started"},
            timeout=DEFAULT_TIMEOUT,
        )
        action_id = action_r.json()["id"]
        session.patch(
            f"{API}/remediation-actions/{action_id}",
            json={"status": "complete", "evidence_status": "not_provided"},
            timeout=DEFAULT_TIMEOUT,
        )

        # Reassess with same evidence
        r = session.post(f"{API}/initiatives/{initiative_id}/reassessment", timeout=DEFAULT_TIMEOUT)
        a2_draft = r.json()
        session.patch(
            f"{API}/assessments/{a2_draft['id']}",
            json={"evidence": DEMO_EVIDENCE},
            timeout=DEFAULT_TIMEOUT,
        )
        session.post(f"{API}/assessments/{a2_draft['id']}/report", timeout=LLM_TIMEOUT)
        a2 = session.get(f"{API}/assessments/{a2_draft['id']}", timeout=DEFAULT_TIMEOUT).json()

        result = self._run_explanation(session, a1, a2, initiative_id)
        explanation = result["explanation"]

        # Must not claim the action substantiated readiness improvement
        full_text = " ".join([
            explanation["summary"],
            *explanation.get("material_changes", []),
        ]).lower()
        assert "evidence confirmed" not in full_text
        assert "substantiated" not in full_text

    def test_eval_scenario_e_ai_unavailable_fallback(self, session):
        """
        Scenario E: AI unavailable — deterministic comparison must remain functional.
        We test the deterministic comparison endpoint directly (no LLM required).
        """
        from demo_seed import DEMO_INITIATIVE, DEMO_EVIDENCE

        a1, _ = _make_completed_assessment(session, DEMO_INITIATIVE, DEMO_EVIDENCE)
        initiative_id = a1["initiative_id"]

        r = session.post(f"{API}/initiatives/{initiative_id}/reassessment", timeout=DEFAULT_TIMEOUT)
        a2_draft = r.json()
        session.patch(
            f"{API}/assessments/{a2_draft['id']}",
            json={"evidence": DEMO_EVIDENCE},
            timeout=DEFAULT_TIMEOUT,
        )
        session.post(f"{API}/assessments/{a2_draft['id']}/report", timeout=LLM_TIMEOUT)
        a2 = session.get(f"{API}/assessments/{a2_draft['id']}", timeout=DEFAULT_TIMEOUT).json()

        # Deterministic comparison must succeed independently of LLM
        r_comp = session.get(
            f"{API}/initiatives/{initiative_id}/comparison",
            params={"from": a1["id"], "to": a2["id"]},
            timeout=DEFAULT_TIMEOUT,
        )
        assert r_comp.status_code == 200, "Deterministic comparison must succeed without LLM"
        comp = r_comp.json()
        assert "overall" in comp
        assert isinstance(comp["overall"]["delta"], int)


# ───────────────────── Regression Smoke ─────────────────────────────

class TestRegressionSmoke:
    """Verify key existing behaviors are unaffected."""

    def test_health_still_ok(self, session):
        r = session.get(f"{API}/health", timeout=DEFAULT_TIMEOUT)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_scoring_engine_unmodified(self, session, demo_initiative_data):
        """Demo evidence still produces the same deterministic score."""
        initiative, evidence = demo_initiative_data
        a = session.post(f"{API}/assessments", json={}, timeout=DEFAULT_TIMEOUT).json()
        session.patch(
            f"{API}/assessments/{a['id']}",
            json={"initiative": initiative, "evidence": evidence},
            timeout=DEFAULT_TIMEOUT,
        )
        r = session.post(f"{API}/assessments/{a['id']}/score", timeout=DEFAULT_TIMEOUT)
        assert r.json()["domain_score"] == 72

    def test_share_link_still_works(self, session, demo_initiative_data):
        initiative, evidence = demo_initiative_data
        assessment, _ = _make_completed_assessment(session, initiative, evidence)
        r = session.post(
            f"{API}/assessments/{assessment['id']}/share", json={}, timeout=LLM_TIMEOUT
        )
        assert r.status_code == 200
        token = r.json()["token"]
        r2 = session.get(f"{API}/shared/{token}", timeout=DEFAULT_TIMEOUT)
        assert r2.status_code == 200

    def test_shared_briefing_strips_ids(self, session, demo_initiative_data):
        """Pre-existing security: report.id and assessment_id must be stripped from shared response."""
        initiative, evidence = demo_initiative_data
        assessment, _ = _make_completed_assessment(session, initiative, evidence)
        r = session.post(
            f"{API}/assessments/{assessment['id']}/share", json={}, timeout=LLM_TIMEOUT
        )
        token = r.json()["token"]
        shared = session.get(f"{API}/shared/{token}", timeout=DEFAULT_TIMEOUT).json()
        rep = shared["report"]
        assert "id" not in rep, "report.id must be stripped from shared briefing"
        assert "assessment_id" not in rep, "assessment_id must be stripped from shared briefing"
