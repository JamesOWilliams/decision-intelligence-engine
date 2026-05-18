"""
Decision Intelligence Engine - Scoring Engine

Pure-Python deterministic scoring. NO LLM involvement here.
Takes evidence (dict of indicator_id -> status) + ontology config,
returns a structured ScoreResult dictionary.

Behavior is unchanged from v1; this revision decomposes the original
monolithic `score_assessment` into small, individually-testable helpers.
"""
from __future__ import annotations
from typing import Dict, List, Any, Tuple
from statistics import pstdev

# Maximum raw maturity score (Operationalized)
MAX_INDICATOR_SCORE = 4

# Confidence thresholds (kept identical to v1; tune later if needed)
HIGH_COMPLETENESS = 0.9
HIGH_SPREAD_MAX = 15
HIGH_MATURITY_MIN = 0.5
MODERATE_COMPLETENESS = 0.7

# Dimension classification thresholds for strengths / risks
STRENGTH_THRESHOLD = 75
RISK_THRESHOLD = 50


# ===== Band & tier lookups =====

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


# ===== Indicator / sub-dim / dim scoring =====

def _score_indicator(
    indicator: Dict[str, Any],
    evidence: Dict[str, str],
    maturity_scale: Dict[str, Any],
) -> Tuple[Dict[str, Any], float, float, int, bool]:
    """
    Score a single indicator.
    Returns: (indicator_result, earned, max_possible, raw_score, was_answered)
    """
    status = evidence.get(indicator["id"], "not_started")
    raw_score = maturity_scale[status]["score"]
    weight = indicator.get("weight", 1.0)
    earned = raw_score * weight
    max_possible = MAX_INDICATOR_SCORE * weight

    indicator_result = {
        "id": indicator["id"],
        "label": indicator["label"],
        "status": status,
        "status_label": maturity_scale[status]["label"],
        "score": raw_score,
        "weight": weight,
    }
    was_answered = status != "not_started"
    return indicator_result, earned, max_possible, raw_score, was_answered


def _score_sub_dimension(
    sub: Dict[str, Any],
    evidence: Dict[str, str],
    maturity_scale: Dict[str, Any],
) -> Tuple[Dict[str, Any], float, float, List[int], int]:
    """
    Returns: (sub_result, sub_earned, sub_max, raw_scores_collected, answered_count)
    """
    sub_indicators: List[Dict[str, Any]] = []
    sub_earned = 0.0
    sub_max = 0.0
    raw_scores: List[int] = []
    answered = 0

    for ind in sub["indicators"]:
        ind_result, earned, max_possible, raw, was_answered = _score_indicator(
            ind, evidence, maturity_scale
        )
        sub_indicators.append(ind_result)
        sub_earned += earned
        sub_max += max_possible
        raw_scores.append(raw)
        if was_answered:
            answered += 1

    sub_score = round((sub_earned / sub_max) * 100) if sub_max > 0 else 0
    return (
        {
            "id": sub["id"],
            "name": sub["name"],
            "score": sub_score,
            "indicators": sub_indicators,
        },
        sub_earned,
        sub_max,
        raw_scores,
        answered,
    )


def _score_dimension(
    dim: Dict[str, Any],
    evidence: Dict[str, str],
    maturity_scale: Dict[str, Any],
    bands: List[Dict[str, Any]],
) -> Tuple[Dict[str, Any], List[int], int, int]:
    """
    Returns: (dim_result, raw_scores_in_dim, answered_count, total_count)
    """
    sub_results: List[Dict[str, Any]] = []
    dim_earned = 0.0
    dim_max = 0.0
    raw_scores: List[int] = []
    answered = 0
    total = 0

    for sub in dim["sub_dimensions"]:
        sub_result, sub_earned, sub_max, sub_raw, sub_answered = _score_sub_dimension(
            sub, evidence, maturity_scale
        )
        sub_results.append(sub_result)
        dim_earned += sub_earned
        dim_max += sub_max
        raw_scores.extend(sub_raw)
        answered += sub_answered
        total += len(sub["indicators"])

    dim_score = round((dim_earned / dim_max) * 100) if dim_max > 0 else 0
    return (
        {
            "id": dim["id"],
            "name": dim["name"],
            "weight": dim["weight"],
            "operational_definition": dim["operational_definition"],
            "score": dim_score,
            "band": _band_for(dim_score, bands),
            "sub_dimensions": sub_results,
        },
        raw_scores,
        answered,
        total,
    )


# ===== Domain-level computations =====

def _compute_domain_score(dimension_results: List[Dict[str, Any]]) -> int:
    return round(sum(d["score"] * d["weight"] for d in dimension_results))


def _compute_confidence(
    answered_count: int,
    total_count: int,
    raw_scores: List[int],
    dimension_scores: List[int],
) -> Tuple[str, Dict[str, float]]:
    completeness = (answered_count / total_count) if total_count else 0.0
    maturity_avg = (
        (sum(raw_scores) / len(raw_scores) / MAX_INDICATOR_SCORE)
        if raw_scores
        else 0.0
    )
    spread = pstdev(dimension_scores) if len(dimension_scores) > 1 else 0.0

    if completeness >= HIGH_COMPLETENESS and spread < HIGH_SPREAD_MAX and maturity_avg >= HIGH_MATURITY_MIN:
        label = "High"
    elif completeness >= MODERATE_COMPLETENESS:
        label = "Moderate"
    else:
        label = "Low"

    signals = {
        "completeness": round(completeness, 2),
        "maturity_avg": round(maturity_avg, 2),
        "dimension_spread": round(spread, 2),
    }
    return label, signals


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


def _apply_blocker_overrides(
    raw_tier: str,
    triggered: List[Dict[str, Any]],
    tier_rank: Dict[str, int],
) -> str:
    """Apply tier ceiling based on the most severe triggered blocker impact."""
    if not triggered:
        return raw_tier

    impacts = {b["impact"] for b in triggered}
    ceiling: str | None = None
    if "production_blocked" in impacts:
        ceiling = "Remediate Before Expansion"
    elif "constrained_pilot_only" in impacts:
        ceiling = "Proceed to Constrained Pilot"
    elif "remediation_required" in impacts:
        ceiling = "Remediate Before Expansion"

    if ceiling and tier_rank[raw_tier] > tier_rank[ceiling]:
        return ceiling
    return raw_tier


def _classify_strengths_risks(
    dimension_results: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    strengths = [
        {"dimension": d["name"], "score": d["score"], "band": d["band"]}
        for d in dimension_results if d["score"] >= STRENGTH_THRESHOLD
    ]
    risks = [
        {"dimension": d["name"], "score": d["score"], "band": d["band"]}
        for d in dimension_results if d["score"] < RISK_THRESHOLD
    ]
    return strengths, risks


# ===== Main entry point =====

def score_assessment(evidence: Dict[str, str], ontology: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deterministic ontology-driven scoring. Returns the full ScoreResult dict.
    Behavior is unchanged from v1 — outputs are bit-identical.
    """
    maturity_scale = ontology["maturity_scale"]
    bands = ontology["maturity_bands"]
    tiers = ontology["recommendation_tiers"]
    tier_rank = ontology["tier_rank"]

    # 1. Score every dimension
    dimension_results: List[Dict[str, Any]] = []
    all_indicator_scores: List[int] = []
    answered_count = 0
    total_count = 0
    for dim in ontology["domain"]["dimensions"]:
        dim_result, dim_raw, dim_answered, dim_total = _score_dimension(
            dim, evidence, maturity_scale, bands
        )
        dimension_results.append(dim_result)
        all_indicator_scores.extend(dim_raw)
        answered_count += dim_answered
        total_count += dim_total

    # 2. Domain weighted score
    domain_score = _compute_domain_score(dimension_results)
    domain_band = _band_for(domain_score, bands)

    # 3. Confidence
    dim_scores = [d["score"] for d in dimension_results]
    confidence, confidence_signals = _compute_confidence(
        answered_count, total_count, all_indicator_scores, dim_scores
    )

    # 4. Recommendation tier + blocker override
    raw_tier = _tier_for(domain_score, tiers)
    triggered_blockers = evaluate_blockers(evidence, ontology)
    tier = _apply_blocker_overrides(raw_tier, triggered_blockers, tier_rank)

    # 5. Strengths / Risks
    strengths, risks = _classify_strengths_risks(dimension_results)

    return {
        "ontology_version": ontology["version"],
        "domain_score": domain_score,
        "maturity_band": domain_band,
        "confidence": confidence,
        "confidence_signals": confidence_signals,
        "recommendation_tier": tier,
        "raw_tier_before_blockers": raw_tier,
        "tier_downgraded": tier != raw_tier,
        "dimensions": dimension_results,
        "triggered_blockers": triggered_blockers,
        "strengths": strengths,
        "risks": risks,
    }
