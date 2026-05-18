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
from typing import Dict, Any, Optional, Set

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

LLM_MODEL = "claude-sonnet-4-5-20250929"
LLM_PROVIDER = "anthropic"


# ===== Shared LLM helpers =====

def _strip_code_fences(text: str) -> str:
    """Remove ``` fences if the model wrapped its JSON in them."""
    if not text.startswith("```"):
        return text
    lines = text.splitlines()
    return "\n".join(ln for ln in lines if not ln.strip().startswith("```")).strip()


async def _call_llm_for_json(
    *,
    session_prefix: str,
    system_prompt: str,
    user_text: str,
    required_keys: Optional[Set[str]] = None,
) -> Dict[str, Any]:
    """
    Make a single-turn Claude Sonnet 4.5 call expecting a JSON object response.
    Raises on any failure (missing key, network error, malformed JSON, missing
    required schema keys). Callers are responsible for catching and falling back.
    """
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY missing")

    chat = LlmChat(
        api_key=api_key,
        session_id=f"{session_prefix}-{uuid.uuid4()}",
        system_message=system_prompt,
    ).with_model(LLM_PROVIDER, LLM_MODEL)

    raw = await chat.send_message(UserMessage(text=user_text))
    text = raw.strip() if isinstance(raw, str) else str(raw).strip()
    text = _strip_code_fences(text)

    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise ValueError(f"Expected JSON object, got {type(parsed).__name__}")

    if required_keys and not required_keys.issubset(parsed.keys()):
        raise ValueError(f"LLM response missing required keys; got {set(parsed.keys())}")

    return parsed

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
    """Generate consultative executive narrative via Claude. Falls back on any failure."""
    try:
        return await _call_llm_for_json(
            session_prefix="die-reasoning",
            system_prompt=SYSTEM_PROMPT,
            user_text=_build_user_message(initiative, scores),
            required_keys={"narrative", "strengths", "risks", "remediation_actions"},
        )
    except Exception as e:
        logger.exception("Reasoning service failed; using fallback. Error: %s", e)
        return _fallback_narrative(initiative, scores)



# ===== Executive Abstract (for shared briefings) =====

ABSTRACT_SYSTEM_PROMPT = """You are writing a short executive abstract that will appear at the top of a shareable, boardroom-grade operational readiness briefing for senior leadership.

PURPOSE:
Compress the assessment into a 2 to 4 sentence executive abstract — the single most distilled summary a senior reader needs to understand:
1. Readiness status (score + maturity band) and recommendation tier
2. The most material risk or blocker (one only)
3. The required executive action implied by the recommendation

TONE & STYLE:
- Board-meeting voice: confident, surgical, unhedged
- No greetings, no emoji, no hedging language, no bullet markers
- Past or present tense; never speculative
- Reference the initiative by name in the first sentence
- Maximum 4 sentences; aim for 2-3

CRITICAL CONSTRAINTS:
- You MUST NOT contradict the provided score, tier, or blocker findings
- You MAY paraphrase or compress the longer narrative
- Return ONLY a single JSON object: {"abstract": "string"}
"""


def _fallback_abstract(initiative: Dict[str, Any], scores: Dict[str, Any]) -> str:
    name = initiative.get("name", "This initiative")
    band = scores["maturity_band"]
    tier = scores["recommendation_tier"]
    score = scores["domain_score"]

    parts = [
        f"{name} achieves an organizational readiness score of {score} ({band} maturity), "
        f"with a current recommendation of {tier.lower()}."
    ]
    if scores.get("triggered_blockers"):
        b = scores["triggered_blockers"][0]
        parts.append(f"The most material blocker is: {b['label'].lower()}.")
    elif scores.get("risks"):
        r = scores["risks"][0]
        parts.append(
            f"The most material risk is {r['dimension']} at {r['score']} ({r['band']})."
        )
    parts.append(
        "Executive sponsorship is required to formalize remediation before scope expansion."
        if tier != "Production Candidate"
        else "Executive sponsorship is required to confirm production readiness gating criteria."
    )
    return " ".join(parts)


async def generate_executive_abstract(
    initiative: Dict[str, Any],
    scores: Dict[str, Any],
    reasoning: Dict[str, Any],
) -> str:
    """Generate a 2-4 sentence boardroom-grade abstract. Deterministic fallback on failure."""
    payload = {
        "initiative_name": initiative.get("name"),
        "domain_score": scores["domain_score"],
        "maturity_band": scores["maturity_band"],
        "confidence": scores["confidence"],
        "recommendation_tier": scores["recommendation_tier"],
        "tier_downgraded_by_blockers": scores.get("tier_downgraded", False),
        "triggered_blockers": [
            {"label": b["label"], "impact": b["impact"]}
            for b in scores.get("triggered_blockers", [])
        ],
        "top_risks": scores.get("risks", [])[:2],
        "existing_narrative": reasoning.get("narrative", ""),
    }
    user_text = (
        "Produce the executive abstract JSON for the following assessment data.\n\n"
        f"{json.dumps(payload, indent=2)}\n\n"
        "Return ONLY the JSON object."
    )
    try:
        parsed = await _call_llm_for_json(
            session_prefix="die-abstract",
            system_prompt=ABSTRACT_SYSTEM_PROMPT,
            user_text=user_text,
            required_keys={"abstract"},
        )
        abstract = (parsed.get("abstract") or "").strip()
        if not abstract:
            raise ValueError("Empty abstract")
        return abstract
    except Exception as e:
        logger.exception("Abstract generation failed; using fallback. Error: %s", e)
        return _fallback_abstract(initiative, scores)
