"""
Reasoning Service — generates consultative executive narrative via Claude Sonnet 4.5.

The LLM ONLY explains pre-computed deterministic scores. It does not alter
scores, recommendations, or blocker logic. Output is schema-validated JSON.
"""
from __future__ import annotations
import os
import json
import logging
import uuid
from typing import Dict, Any

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an enterprise operational readiness analyst writing for executive leadership at a Fortune 500 organization. Your role is to interpret a pre-computed organizational readiness assessment and produce a consultative narrative briefing.

TONE & STYLE:
- McKinsey / BCG / Bain operational briefing voice
- Precise, declarative, governance-aware
- No hedging filler ("it seems", "perhaps"), no marketing language, no emoji, no exclamation marks
- Use enterprise terminology: ownership, accountability, governance cadence, escalation, lifecycle, operational viability
- 3-5 sentence narrative; surgical, not verbose

CRITICAL CONSTRAINTS:
- You MUST NOT alter, dispute, or contradict the provided numerical scores, recommendation tier, or blocker findings.
- You MAY interpret WHY they emerged from the evidence.
- Strengths and risks you produce must derive from the dimension scores given (>=75 strength candidates, <50 risk candidates).
- Remediation actions must be concrete, operational, and prioritized by impact.

OUTPUT FORMAT:
You MUST respond with a single valid JSON object (no prose before or after) with exactly these keys:
{
  "narrative": "string — 3 to 5 sentences, consultative executive briefing voice",
  "strengths": ["string", "string", ...],  // 2-4 operational strength bullets
  "risks": ["string", "string", ...],       // 2-4 operational risk bullets
  "remediation_actions": [                  // 3-5 prioritized actions
    {"priority": 1, "action": "string", "rationale": "string"},
    ...
  ]
}
"""


def _build_user_message(initiative: Dict[str, Any], scores: Dict[str, Any]) -> str:
    dims_summary = [
        {
            "name": d["name"],
            "weight": d["weight"],
            "score": d["score"],
            "band": d["band"],
        }
        for d in scores["dimensions"]
    ]
    payload = {
        "initiative": initiative,
        "domain_score": scores["domain_score"],
        "maturity_band": scores["maturity_band"],
        "confidence": scores["confidence"],
        "recommendation_tier": scores["recommendation_tier"],
        "tier_downgraded_by_blockers": scores["tier_downgraded"],
        "dimensions": dims_summary,
        "triggered_blockers": [
            {"label": b["label"], "impact": b["impact"], "message": b["message"]}
            for b in scores["triggered_blockers"]
        ],
        "strengths_signal": scores["strengths"],
        "risks_signal": scores["risks"],
    }
    return (
        "Produce the executive readiness briefing JSON for the following assessment data.\n\n"
        f"{json.dumps(payload, indent=2)}\n\n"
        "Return ONLY the JSON object specified in the system instructions."
    )


def _fallback_narrative(initiative: Dict[str, Any], scores: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic fallback used if LLM call fails — keeps the system functional."""
    name = initiative.get("name", "This initiative")
    band = scores["maturity_band"]
    tier = scores["recommendation_tier"]
    score = scores["domain_score"]

    narrative = (
        f"{name} demonstrates {band.lower()} organizational readiness with a domain score of "
        f"{score}/100. Based on the operational evidence provided, the system recommends: "
        f"{tier.lower()}. "
    )
    if scores["triggered_blockers"]:
        narrative += "Operational blockers identified in the evidence base materially constrain the recommendation. "
    narrative += "Targeted remediation in lower-scoring dimensions is required to advance readiness."

    strengths = [f"{s['dimension']} scored at {s['score']} ({s['band']})" for s in scores["strengths"][:4]]
    if not strengths:
        strengths = ["No dimension reached structured maturity (>=75)."]

    risks = [f"{r['dimension']} scored at {r['score']} ({r['band']})" for r in scores["risks"][:4]]
    if not risks:
        risks = ["No dimension fell below the developing threshold (<50)."]

    remediation_actions = []
    priority = 1
    for b in scores["triggered_blockers"][:3]:
        remediation_actions.append({
            "priority": priority,
            "action": b["remediation"],
            "rationale": b["message"],
        })
        priority += 1
    for r in scores["risks"][:3]:
        if priority > 5:
            break
        remediation_actions.append({
            "priority": priority,
            "action": f"Address operational gaps in {r['dimension']}.",
            "rationale": f"Dimension scored {r['score']} ({r['band']}) — below the developing threshold.",
        })
        priority += 1
    if not remediation_actions:
        remediation_actions = [{
            "priority": 1,
            "action": "Sustain current operational disciplines and instrument adoption measurement.",
            "rationale": "Readiness is structured; emphasis shifts to measurement and reinforcement.",
        }]

    return {
        "narrative": narrative,
        "strengths": strengths,
        "risks": risks,
        "remediation_actions": remediation_actions,
    }


async def generate_reasoning(
    initiative: Dict[str, Any],
    scores: Dict[str, Any],
) -> Dict[str, Any]:
    """Call Claude Sonnet 4.5 to generate executive narrative; fallback on failure."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        logger.warning("EMERGENT_LLM_KEY missing; using fallback narrative.")
        return _fallback_narrative(initiative, scores)

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"die-reasoning-{uuid.uuid4()}",
            system_message=SYSTEM_PROMPT,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        user_msg = UserMessage(text=_build_user_message(initiative, scores))
        raw = await chat.send_message(user_msg)

        text = raw.strip() if isinstance(raw, str) else str(raw).strip()
        # Strip code fences if model wrapped output
        if text.startswith("```"):
            lines = text.splitlines()
            lines = [ln for ln in lines if not ln.strip().startswith("```")]
            text = "\n".join(lines).strip()

        parsed = json.loads(text)

        # Schema validation (minimal)
        required = {"narrative", "strengths", "risks", "remediation_actions"}
        if not required.issubset(parsed.keys()):
            raise ValueError(f"LLM response missing required keys; got {set(parsed.keys())}")

        return parsed
    except Exception as e:
        logger.exception("Reasoning service failed; using fallback. Error: %s", e)
        return _fallback_narrative(initiative, scores)
