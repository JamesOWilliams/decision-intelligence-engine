"""
Demo seed data — Enterprise AI Knowledge Assistant Rollout.

A universally recognizable scenario chosen so reviewers can immediately
understand operational readiness implications regardless of industry.

Target: ~72 / Structured / Proceed to Constrained Pilot
Training dimension intentionally low to surface meaningful risks.
"""

DEMO_INITIATIVE = {
    "name": "Enterprise AI Knowledge Assistant Rollout",
    "business_unit": "Global Operations & Shared Services",
    "description": (
        "Internal AI-powered knowledge assistant designed to serve approximately 12,000 "
        "employees across operations, HR, finance, and IT. The assistant retrieves "
        "policies, procedures, and operational guidance and routes complex requests to "
        "the appropriate support function."
    ),
    "target_workflow": "Employee self-service for policy and procedure inquiries; first-line knowledge retrieval.",
    "expected_outcomes": (
        "Reduce tier-1 helpdesk volume by ~40%; reduce average time-to-answer from 15 minutes to "
        "under 90 seconds; improve cross-functional policy consistency."
    ),
    "stage": "pilot",
}

# Evidence calibrated to land at ~72 (Structured / Constrained Pilot).
DEMO_EVIDENCE = {
    # Change Management Maturity — target 75%
    "rollout_plan_documented": "operationalized",
    "transformation_playbook": "approved",
    "executive_communication_strategy": "approved",
    "adoption_kpis_defined": "drafted",
    "change_champion_network": "approved",
    "governance_cadence_established": "approved",

    # Stakeholder Alignment — target ~88%
    "executive_sponsor_identified": "operationalized",
    "business_owner_engaged": "approved",
    "cross_functional_kickoff": "operationalized",
    "engineering_teams_engaged": "operationalized",
    "governance_legal_engaged": "approved",
    "success_metrics_documented": "approved",

    # Operational Ownership Clarity — target 70%
    "business_owner_assigned": "operationalized",
    "technical_owner_assigned": "approved",
    "escalation_workflow_documented": "approved",
    "support_model_defined": "drafted",
    "lifecycle_review_cadence": "drafted",

    # Cross-Functional Coordination — target 75%
    "dependency_mapping_completed": "approved",
    "cross_functional_cadence": "approved",
    "delivery_sequencing_documented": "approved",
    "workflow_impacts_documented": "approved",
    "escalation_coordination_defined": "approved",

    # Training & Enablement Readiness — target 35% (the soft spot)
    "training_plan_documented": "drafted",
    "operational_documentation_prepared": "drafted",
    "support_resources_allocated": "informal",
    "user_feedback_process": "informal",
    "adoption_reinforcement_plan": "informal",
}
