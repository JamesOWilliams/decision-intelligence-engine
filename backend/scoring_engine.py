"""
Decision Intelligence Engine - Scoring Engine

Pure-Python deterministic scoring. NO LLM involvement here.
Takes evidence (dict of indicator_id -> status) + ontology config,
returns a structured ScoreResult dictionary.
"""
from __future__ import annotations
from typing import Dict, List, Any
from statistics import pstdev


def _band_for(score: int, bands: List[Dict[str, Any]]) -> str:
    for b in bands:
        if b["min"] <= score <= b["max"]:
            return b["band"]
    return bands[0]["band"]


def _tier_for(score: int, tiers: List[Dict[str, Any]]) -> str:
    for t in tiers:
        if t["min"] <= score <= t["max"]:
            return t["tier"]
    return tiers[-1]["tier"]


def _flatten_indicators(ontology: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return all indicators with their dimension/sub-dimension context."""
    flat = []
    for dim in ontology["domain"]["dimensions"]:
        for sub in dim["sub_dimensions"]:
            for ind in sub["indicators"]:
                flat.append({
                    "dimension_id": dim["id"],
                    "dimension_name": dim["name"],
                    "sub_dimension_id": sub["id"],
                    "sub_dimension_name": sub["name"],
                    "indicator_id": ind["id"],
                    "label": ind["label"],
                    "weight": ind.get("weight", 1.0),
                })
    return flat


def _derive_confidence(completeness: float, maturity_avg: float, spread: float) -> str:
    """Confidence is a function of evidence completeness, average maturity, and consistency."""
    if completeness >= 0.9 and spread < 15 and maturity_avg >= 0.5:
        return "High"
    if completeness >= 0.7:
        return "Moderate"
    return "Low"


def _downgrade_tier(current: str, floor_or_ceiling: str, tier_rank: Dict[str, int]) -> str:
    """Apply a ceiling: never let recommendation exceed `floor_or_ceiling`."""
    if tier_rank[current] > tier_rank[floor_or_ceiling]:
        return floor_or_ceiling
    return current


def evaluate_blockers(evidence: Dict[str, str], ontology: Dict[str, Any]) -> List[Dict[str, Any]]:
    triggered = []
    for blocker in ontology.get("blockers", []):
        status = evidence.get(blocker["indicator_id"], "not_started")
        if status in blocker["trigger_when_status_in"]:
            triggered.append({
                "id": blocker["id"],
                "indicator_id": blocker["indicator_id"],
                "impact": blocker["impact"],
                "label": blocker["label"],
                "message": blocker["message"],
                "remediation": blocker["remediation"],
            })
    return triggered


def score_assessment(evidence: Dict[str, str], ontology: Dict[str, Any]) -> Dict[str, Any]:
    maturity_scale = ontology["maturity_scale"]
    bands = ontology["maturity_bands"]
    tiers = ontology["recommendation_tiers"]
    tier_rank = ontology["tier_rank"]
    max_score = 4  # Operationalized

    dimension_results = []
    all_indicator_scores: List[float] = []
    answered_count = 0
    total_count = 0

    for dim in ontology["domain"]["dimensions"]:
        dim_earned = 0.0
        dim_max = 0.0
        sub_results = []

        for sub in dim["sub_dimensions"]:
            sub_indicators = []
            sub_earned = 0.0
            sub_max = 0.0

            for ind in sub["indicators"]:
                total_count += 1
                status = evidence.get(ind["id"], "not_started")
                raw_score = maturity_scale[status]["score"]
                weight = ind.get("weight", 1.0)
                indicator_earned = raw_score * weight
                indicator_max = max_score * weight

                sub_earned += indicator_earned
                sub_max += indicator_max
                if status != "not_started":
                    answered_count += 1
                all_indicator_scores.append(raw_score)

                sub_indicators.append({
                    "id": ind["id"],
                    "label": ind["label"],
                    "status": status,
                    "status_label": maturity_scale[status]["label"],
                    "score": raw_score,
                    "weight": weight,
                })

            sub_score = round((sub_earned / sub_max) * 100) if sub_max > 0 else 0
            sub_results.append({
                "id": sub["id"],
                "name": sub["name"],
                "score": sub_score,
                "indicators": sub_indicators,
            })
            dim_earned += sub_earned
            dim_max += sub_max

        dim_score = round((dim_earned / dim_max) * 100) if dim_max > 0 else 0
        dimension_results.append({
            "id": dim["id"],
            "name": dim["name"],
            "weight": dim["weight"],
            "operational_definition": dim["operational_definition"],
            "score": dim_score,
            "band": _band_for(dim_score, bands),
            "sub_dimensions": sub_results,
        })

    # ---- Domain weighted score ----
    domain_score = round(
        sum(d["score"] * d["weight"] for d in dimension_results)
    )
    domain_band = _band_for(domain_score, bands)

    # ---- Confidence ----
    completeness = answered_count / total_count if total_count else 0.0
    maturity_avg = (sum(all_indicator_scores) / len(all_indicator_scores) / max_score) if all_indicator_scores else 0.0
    dim_scores = [d["score"] for d in dimension_results]
    spread = pstdev(dim_scores) if len(dim_scores) > 1 else 0.0
    confidence = _derive_confidence(completeness, maturity_avg, spread)

    # ---- Recommendation tier with blocker override ----
    raw_tier = _tier_for(domain_score, tiers)
    triggered_blockers = evaluate_blockers(evidence, ontology)

    tier = raw_tier
    impacts = {b["impact"] for b in triggered_blockers}
    if "production_blocked" in impacts:
        tier = _downgrade_tier(tier, "Remediate Before Expansion", tier_rank)
    elif "constrained_pilot_only" in impacts:
        tier = _downgrade_tier(tier, "Proceed to Constrained Pilot", tier_rank)
    elif "remediation_required" in impacts:
        tier = _downgrade_tier(tier, "Remediate Before Expansion", tier_rank)

    # ---- Strengths / Risks (dimension-level) ----
    strengths = [
        {"dimension": d["name"], "score": d["score"], "band": d["band"]}
        for d in dimension_results if d["score"] >= 75
    ]
    risks = [
        {"dimension": d["name"], "score": d["score"], "band": d["band"]}
        for d in dimension_results if d["score"] < 50
    ]

    return {
        "ontology_version": ontology["version"],
        "domain_score": domain_score,
        "maturity_band": domain_band,
        "confidence": confidence,
        "confidence_signals": {
            "completeness": round(completeness, 2),
            "maturity_avg": round(maturity_avg, 2),
            "dimension_spread": round(spread, 2),
        },
        "recommendation_tier": tier,
        "raw_tier_before_blockers": raw_tier,
        "tier_downgraded": tier != raw_tier,
        "dimensions": dimension_results,
        "triggered_blockers": triggered_blockers,
        "strengths": strengths,
        "risks": risks,
    }
