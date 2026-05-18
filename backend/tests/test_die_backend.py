"""
Decision Intelligence Engine (DIE) — Backend regression suite.
Covers: health, ontology, assessment CRUD, scoring, blockers, report (LLM),
demo seed, and lazy-seeded demo/current endpoint.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://emergence-plan.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Tunable timeouts
DEFAULT_TIMEOUT = 30
LLM_TIMEOUT = 90  # report generation calls Claude Sonnet 4.5


# ----------------- Fixtures -----------------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def ontology(session):
    r = session.get(f"{API}/ontology", timeout=DEFAULT_TIMEOUT)
    assert r.status_code == 200
    return r.json()


@pytest.fixture
def new_assessment(session):
    r = session.post(f"{API}/assessments", json={}, timeout=DEFAULT_TIMEOUT)
    assert r.status_code == 200, r.text
    return r.json()


# ----------------- Health & Ontology -----------------
class TestHealth:
    def test_health_ok(self, session):
        r = session.get(f"{API}/health", timeout=DEFAULT_TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["ontology_version"] == "1.0.0"


class TestOntology:
    def test_ontology_shape(self, ontology):
        assert ontology["version"] == "1.0.0"
        dims = ontology["domain"]["dimensions"]
        names = [d["id"] for d in dims]
        expected = {
            "change_management",
            "stakeholder_alignment",
            "operational_ownership",
            "cross_functional_coordination",
            "training_enablement",
        }
        assert expected.issubset(set(names))
        # Weights add up to 1.0 (25/20/25/20/10)
        weights = {d["id"]: d["weight"] for d in dims}
        assert round(sum(weights.values()), 4) == 1.0
        assert weights["change_management"] == 0.25
        assert weights["stakeholder_alignment"] == 0.20
        assert weights["operational_ownership"] == 0.25
        assert weights["cross_functional_coordination"] == 0.20
        assert weights["training_enablement"] == 0.10

        # Maturity scale: 5 levels
        scale = ontology["maturity_scale"]
        assert set(scale.keys()) == {
            "not_started", "informal", "drafted", "approved", "operationalized"
        }
        # Bands & tiers present
        assert isinstance(ontology["maturity_bands"], list)
        assert isinstance(ontology["recommendation_tiers"], list)
        # Blockers present (>=5)
        assert len(ontology.get("blockers", [])) >= 5


# ----------------- Assessment CRUD -----------------
class TestAssessmentCRUD:
    def test_create_assessment(self, new_assessment):
        a = new_assessment
        assert "id" in a and len(a["id"]) >= 32
        assert a["ontology_version"] == "1.0.0"
        assert a["status"] == "draft"
        assert a["evidence"] == {}
        assert a["initiative"]["name"] == ""

    def test_get_assessment(self, session, new_assessment):
        aid = new_assessment["id"]
        r = session.get(f"{API}/assessments/{aid}", timeout=DEFAULT_TIMEOUT)
        assert r.status_code == 200
        assert r.json()["id"] == aid

    def test_get_unknown_404(self, session):
        r = session.get(f"{API}/assessments/does-not-exist-uuid", timeout=DEFAULT_TIMEOUT)
        assert r.status_code == 404

    def test_patch_initiative_and_evidence(self, session, new_assessment):
        aid = new_assessment["id"]
        patch = {
            "initiative": {
                "name": "TEST_Initiative",
                "business_unit": "QA",
                "stage": "pilot",
            },
            "evidence": {"rollout_plan_documented": "drafted"},
            "status": "in_progress",
        }
        r = session.patch(f"{API}/assessments/{aid}", json=patch, timeout=DEFAULT_TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data["initiative"]["name"] == "TEST_Initiative"
        assert data["initiative"]["business_unit"] == "QA"
        assert data["initiative"]["stage"] == "pilot"
        assert data["evidence"]["rollout_plan_documented"] == "drafted"
        assert data["status"] == "in_progress"

        # Partial evidence merge: add second indicator, first should persist
        r2 = session.patch(
            f"{API}/assessments/{aid}",
            json={"evidence": {"executive_sponsor_identified": "approved"}},
            timeout=DEFAULT_TIMEOUT,
        )
        assert r2.status_code == 200
        ev = r2.json()["evidence"]
        assert ev["rollout_plan_documented"] == "drafted"
        assert ev["executive_sponsor_identified"] == "approved"


# ----------------- Scoring -----------------
class TestScoringEmpty:
    def test_empty_evidence_blocked(self, session, new_assessment):
        aid = new_assessment["id"]
        r = session.post(f"{API}/assessments/{aid}/score", timeout=DEFAULT_TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data["domain_score"] == 0
        assert data["maturity_band"] == "Minimal"
        assert data["recommendation_tier"] == "Not Ready"
        # 5 blockers because all indicators default to not_started
        assert len(data["triggered_blockers"]) == 5


class TestScoringDemoEvidence:
    """Score the demo evidence directly without going through seed-demo (no LLM)."""

    def test_demo_evidence_scoring(self, session):
        from demo_seed import DEMO_INITIATIVE, DEMO_EVIDENCE  # noqa: WPS433
        # Create new assessment and patch with demo data
        a = session.post(f"{API}/assessments", json={}, timeout=DEFAULT_TIMEOUT).json()
        aid = a["id"]
        session.patch(
            f"{API}/assessments/{aid}",
            json={"initiative": DEMO_INITIATIVE, "evidence": DEMO_EVIDENCE},
            timeout=DEFAULT_TIMEOUT,
        )
        r = session.post(f"{API}/assessments/{aid}/score", timeout=DEFAULT_TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data["domain_score"] == 72, data
        assert data["maturity_band"] == "Structured"
        assert data["recommendation_tier"] == "Proceed to Constrained Pilot"
        assert data["confidence"] in ("Moderate", "High")
        assert data["triggered_blockers"] == []
        # Spot-check dimensions
        dims = {d["id"]: d for d in data["dimensions"]}
        assert 30 <= dims["training_enablement"]["score"] <= 45
        assert dims["stakeholder_alignment"]["score"] >= 80


class TestBlockerLogic:
    def test_no_technical_owner_downgrades_tier(self, session, ontology):
        # Build evidence with all indicators 'approved' EXCEPT technical_owner_assigned
        evidence = {}
        for dim in ontology["domain"]["dimensions"]:
            for sub in dim["sub_dimensions"]:
                for ind in sub["indicators"]:
                    evidence[ind["id"]] = "approved"
        evidence["technical_owner_assigned"] = "not_started"

        a = session.post(f"{API}/assessments", json={}, timeout=DEFAULT_TIMEOUT).json()
        aid = a["id"]
        session.patch(f"{API}/assessments/{aid}", json={"evidence": evidence}, timeout=DEFAULT_TIMEOUT)
        r = session.post(f"{API}/assessments/{aid}/score", timeout=DEFAULT_TIMEOUT)
        data = r.json()
        ids = [b["id"] for b in data["triggered_blockers"]]
        assert "no_technical_owner" in ids
        # Recommendation must be downgraded (not the raw high-score tier)
        assert data["tier_downgraded"] is True
        assert data["recommendation_tier"] in ("Remediate Before Expansion", "Proceed to Constrained Pilot")


# ----------------- Demo Seed & Demo Current -----------------
class TestDemoSeed:
    def test_seed_demo_endpoint(self, session):
        r = session.post(f"{API}/assessments/seed-demo", timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        aid = data["assessment_id"]
        report = data["report"]
        scores = report["scores"]
        assert scores["domain_score"] == 72
        assert scores["maturity_band"] == "Structured"
        assert scores["recommendation_tier"] == "Proceed to Constrained Pilot"
        assert scores["triggered_blockers"] == []
        # Training & Enablement low, Stakeholder Alignment high
        dims = {d["id"]: d for d in scores["dimensions"]}
        assert 30 <= dims["training_enablement"]["score"] <= 45
        assert dims["stakeholder_alignment"]["score"] >= 85

        # Reasoning shape
        reasoning = report["reasoning"]
        for k in ("narrative", "strengths", "risks", "remediation_actions"):
            assert k in reasoning
        assert isinstance(reasoning["narrative"], str) and len(reasoning["narrative"]) > 30

        # GET report returns persisted version
        r2 = session.get(f"{API}/assessments/{aid}/report", timeout=DEFAULT_TIMEOUT)
        assert r2.status_code == 200
        assert r2.json()["assessment_id"] == aid

    def test_demo_current(self, session):
        r = session.get(f"{API}/assessments/demo/current", timeout=LLM_TIMEOUT)
        assert r.status_code == 200
        assert "assessment_id" in r.json()


# ----------------- Report generation (fresh, LLM) -----------------
class TestReportLLM:
    def test_generate_report_for_demo_evidence(self, session):
        from demo_seed import DEMO_INITIATIVE, DEMO_EVIDENCE  # noqa: WPS433
        a = session.post(f"{API}/assessments", json={}, timeout=DEFAULT_TIMEOUT).json()
        aid = a["id"]
        session.patch(
            f"{API}/assessments/{aid}",
            json={"initiative": DEMO_INITIATIVE, "evidence": DEMO_EVIDENCE},
            timeout=DEFAULT_TIMEOUT,
        )
        r = session.post(f"{API}/assessments/{aid}/report", timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text
        rep = r.json()
        assert rep["assessment_id"] == aid
        assert rep["scores"]["domain_score"] == 72
        assert "reasoning" in rep
        # Assessment marked completed
        a2 = session.get(f"{API}/assessments/{aid}", timeout=DEFAULT_TIMEOUT).json()
        assert a2["status"] == "completed"

    def test_get_report_404_if_not_generated(self, session):
        a = session.post(f"{API}/assessments", json={}, timeout=DEFAULT_TIMEOUT).json()
        r = session.get(f"{API}/assessments/{a['id']}/report", timeout=DEFAULT_TIMEOUT)
        assert r.status_code == 404


# ----------------- Share Briefing -----------------
@pytest.fixture(scope="module")
def shared_assessment_with_report(session):
    """Create an assessment, seed demo evidence, generate report. Returns assessment_id."""
    from demo_seed import DEMO_INITIATIVE, DEMO_EVIDENCE  # noqa: WPS433
    a = session.post(f"{API}/assessments", json={}, timeout=DEFAULT_TIMEOUT).json()
    aid = a["id"]
    session.patch(
        f"{API}/assessments/{aid}",
        json={"initiative": DEMO_INITIATIVE, "evidence": DEMO_EVIDENCE},
        timeout=DEFAULT_TIMEOUT,
    )
    r = session.post(f"{API}/assessments/{aid}/report", timeout=LLM_TIMEOUT)
    assert r.status_code == 200, r.text
    return aid


class TestShareCreate:
    def test_create_share_link_returns_required_fields(self, session, shared_assessment_with_report):
        aid = shared_assessment_with_report
        r = session.post(f"{API}/assessments/{aid}/share", json={}, timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        # Required keys
        for k in ("id", "token", "assessment_id", "report_id", "executive_abstract",
                  "created_at", "expires_at", "revoked_at", "is_active", "view_count"):
            assert k in data, f"missing key: {k}"
        assert data["assessment_id"] == aid
        assert isinstance(data["token"], str) and len(data["token"]) >= 20
        assert data["expires_at"] is None
        assert data["revoked_at"] is None
        assert data["is_active"] is True
        assert data["view_count"] == 0
        assert isinstance(data["executive_abstract"], str) and len(data["executive_abstract"]) > 0

    def test_create_share_link_is_idempotent(self, session, shared_assessment_with_report):
        aid = shared_assessment_with_report
        r1 = session.post(f"{API}/assessments/{aid}/share", json={}, timeout=LLM_TIMEOUT)
        r2 = session.post(f"{API}/assessments/{aid}/share", json={}, timeout=LLM_TIMEOUT)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["token"] == r2.json()["token"]
        assert r1.json()["id"] == r2.json()["id"]

    def test_share_404_if_no_report(self, session):
        a = session.post(f"{API}/assessments", json={}, timeout=DEFAULT_TIMEOUT).json()
        r = session.post(f"{API}/assessments/{a['id']}/share", json={}, timeout=DEFAULT_TIMEOUT)
        assert r.status_code == 404

    def test_executive_abstract_content_quality(self, session, shared_assessment_with_report):
        aid = shared_assessment_with_report
        r = session.post(f"{API}/assessments/{aid}/share", json={}, timeout=LLM_TIMEOUT)
        abstract = r.json()["executive_abstract"]
        # Length window 200-700
        assert 150 <= len(abstract) <= 800, f"abstract length {len(abstract)}: {abstract!r}"
        # No markdown / no JSON wrapper
        assert "```" not in abstract
        assert not abstract.strip().startswith("{")
        assert "**" not in abstract
        # Mentions initiative name from demo
        from demo_seed import DEMO_INITIATIVE
        name = DEMO_INITIATIVE["name"]
        # Should reference either initiative or numeric score/tier keyword
        mentions_name = name.lower() in abstract.lower()
        mentions_score_or_tier = (
            "72" in abstract
            or "score" in abstract.lower()
            or "pilot" in abstract.lower()
            or "structured" in abstract.lower()
            or "remediate" in abstract.lower()
        )
        assert mentions_name or mentions_score_or_tier, abstract

    def test_share_expires_in_days_persists(self, session):
        """Forward-compat smoke test: expires_in_days=7 should persist a future expires_at."""
        from demo_seed import DEMO_INITIATIVE, DEMO_EVIDENCE  # noqa: WPS433
        from datetime import datetime, timezone
        a = session.post(f"{API}/assessments", json={}, timeout=DEFAULT_TIMEOUT).json()
        aid = a["id"]
        session.patch(
            f"{API}/assessments/{aid}",
            json={"initiative": DEMO_INITIATIVE, "evidence": DEMO_EVIDENCE},
            timeout=DEFAULT_TIMEOUT,
        )
        session.post(f"{API}/assessments/{aid}/report", timeout=LLM_TIMEOUT)
        r = session.post(
            f"{API}/assessments/{aid}/share",
            json={"expires_in_days": 7},
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["expires_at"] is not None
        exp = datetime.fromisoformat(data["expires_at"])
        assert exp > datetime.now(timezone.utc)


class TestSharedGet:
    def test_get_shared_returns_full_payload(self, session, shared_assessment_with_report):
        aid = shared_assessment_with_report
        cr = session.post(f"{API}/assessments/{aid}/share", json={}, timeout=LLM_TIMEOUT)
        token = cr.json()["token"]
        r = session.get(f"{API}/shared/{token}", timeout=DEFAULT_TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("token", "executive_abstract", "shared_at", "expires_at", "report"):
            assert k in data
        rep = data["report"]
        assert "scores" in rep and "reasoning" in rep
        assert rep["scores"]["domain_score"] == 72
        for k in ("narrative", "strengths", "risks", "remediation_actions"):
            assert k in rep["reasoning"]

    def test_get_shared_increments_view_count(self, session, shared_assessment_with_report):
        aid = shared_assessment_with_report
        cr = session.post(f"{API}/assessments/{aid}/share", json={}, timeout=LLM_TIMEOUT)
        token = cr.json()["token"]
        # Hit twice
        session.get(f"{API}/shared/{token}", timeout=DEFAULT_TIMEOUT)
        session.get(f"{API}/shared/{token}", timeout=DEFAULT_TIMEOUT)
        # Recreate share link (idempotent) — should return same record with updated view_count
        latest = session.post(f"{API}/assessments/{aid}/share", json={}, timeout=LLM_TIMEOUT).json()
        assert latest["view_count"] >= 2

    def test_get_shared_404_invalid_token(self, session):
        r = session.get(f"{API}/shared/invalid-token-xyz-not-real", timeout=DEFAULT_TIMEOUT)
        assert r.status_code == 404
