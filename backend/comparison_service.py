"""
Comparison Service — pure deterministic assessment-to-assessment comparison.

No LLM involvement. Uses frozen score snapshots only.
Both assessments must be completed and have score_snapshots.
Cross-ontology comparison: overall score only (dimensions suppressed).
"""
from __future__ import annotations
from typing import Dict, Any, List, Optional


def compare_assessments(
    snap_from: Dict[str, Any],
    snap_to: Dict[str, Any],
    assess_from: Dict[str, Any],
    assess_to: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Pure deterministic comparison between two frozen score snapshots.
    Returns structured comparison dict.

    D-D — Cross-Ontology Comparison:
    - Overall score comparison is permitted across ontology versions.
    - Dimension comparison is permitted only when ontology versions match.
    """
    prev_score: int = snap_from["domain_score"]
    curr_score: int = snap_to["domain_score"]
    delta: int = curr_score - prev_score

    prev_band: str = snap_from["maturity_band"]
    curr_band: str = snap_to["maturity_band"]
    prev_tier: str = snap_from.get("recommendation_tier", "")
    curr_tier: str = snap_to.get("recommendation_tier", "")

    prev_version: str = snap_from.get("ontology_version", assess_from.get("ontology_version", ""))
    curr_version: str = snap_to.get("ontology_version", assess_to.get("ontology_version", ""))

    dimensions_comparable: bool = bool(prev_version and curr_version and prev_version == curr_version)

    # Dimension-level comparison — only when ontology versions match
    dimension_comparisons: List[Dict[str, Any]] = []
    if dimensions_comparable:
        prev_dims = {d["id"]: d for d in snap_from.get("dimensions", [])}
        curr_dims = {d["id"]: d for d in snap_to.get("dimensions", [])}

        for dim_id, curr_dim in curr_dims.items():
            if dim_id in prev_dims:
                prev_dim = prev_dims[dim_id]
                dim_delta = curr_dim["score"] - prev_dim["score"]
                dimension_comparisons.append({
                    "id": dim_id,
                    "name": curr_dim["name"],
                    "weight": curr_dim.get("weight"),
                    "previous_score": prev_dim["score"],
                    "current_score": curr_dim["score"],
                    "delta": dim_delta,
                    "previous_band": prev_dim["band"],
                    "current_band": curr_dim["band"],
                })

    maturity_transition: Optional[str] = (
        f"{prev_band} → {curr_band}" if prev_band != curr_band else None
    )
    tier_transition: Optional[str] = (
        f"{prev_tier} → {curr_tier}" if prev_tier != curr_tier else None
    )

    return {
        "previous_assessment": {
            "id": assess_from["id"],
            "ontology_version": prev_version,
            "scored_at": assess_from.get("scored_at") or assess_from.get("completed_at"),
            "completed_at": assess_from.get("completed_at"),
        },
        "current_assessment": {
            "id": assess_to["id"],
            "ontology_version": curr_version,
            "scored_at": assess_to.get("scored_at") or assess_to.get("completed_at"),
            "completed_at": assess_to.get("completed_at"),
        },
        "overall": {
            "previous_score": prev_score,
            "current_score": curr_score,
            "delta": delta,
            "previous_band": prev_band,
            "current_band": curr_band,
            "previous_tier": prev_tier,
            "current_tier": curr_tier,
            "maturity_transition": maturity_transition,
            "tier_transition": tier_transition,
        },
        "dimensions_comparable": dimensions_comparable,
        "dimensions": dimension_comparisons,
        "previous_triggered_blockers": snap_from.get("triggered_blockers", []),
        "current_triggered_blockers": snap_to.get("triggered_blockers", []),
        "previous_risks": snap_from.get("risks", []),
        "current_risks": snap_to.get("risks", []),
    }
