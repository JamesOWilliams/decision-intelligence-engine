# DIE Orbit — Product Requirements Document

## Original Problem Statement
Build an enterprise operational readiness assessment for AI initiatives with ontology-driven scoring, blocker logic, confidence levels, and an explainable executive report. Architecture must separate deterministic scoring from LLM-generated narrative explainability. Includes: assessment wizard, printable executive report, tokenized Share Briefing view-only capability, passive view-count telemetry, and a closed-loop remediation tracking + reassessment experience. No user authentication required for MVP.

## Tech Stack
- React 19 (Create React App + CRACO), TailwindCSS, IBM Plex fonts, Newsreader serif
- FastAPI, Motor (async MongoDB)
- Claude Sonnet 4.5 via Emergent LLM Key (reasoning/narrative only — never scoring)

## Core Architecture Principle
> AI augments interpretation. Deterministic systems remain authoritative for readiness scoring.

---

## What's Been Implemented

### Phase 1 — MVP (Complete)
- **Assessment Wizard** (Intake → Evidence → Report flow)
- **Deterministic Scoring Engine** (`scoring_engine.py`) — 5 dimensions, weighted, blocker logic, maturity bands
- **LLM Reasoning Service** (`reasoning_service.py`) — Claude Sonnet 4.5 generates boardroom narrative from pre-calculated scores
- **Executive Briefing page** (`/report/:sessionId`) — score hero, dimension breakdown, blockers, strengths/risks, remediation actions
- **Share Briefing** — tokenized read-only URL, passive view-count telemetry
- **Shared Briefing page** (`/shared/:token`)
- **Demo seed** — seeded assessment + report
- **Mobile responsiveness** — TopNav, Dimension Nav, report headers

### Phase 2 — Remediation + Reassessment (Complete — Feb 2026)
- **Durable Initiative identity** — `initiatives` MongoDB collection; lazy migration for legacy assessments (D-C)
- **Score snapshot immutability** — `score_snapshot` + `scored_at` frozen on first report generation; never overwritten (INV-001, D-B)
- **Assessment immutability enforcement** — PATCH returns 409 for completed assessments when evidence/initiative modified (D-E)
- **Remediation Plans** — `remediation_plans` collection; anchored to deterministic blocker or risk finding (D-A)
- **Remediation Actions** — `remediation_actions` collection; owner, target date, status, evidence requirement, evidence reference, evidence status
- **Reassessment** — creates new draft assessment linked to existing initiative (`POST /api/initiatives/:id/reassessment`)
- **Assessment History** — per-initiative ordered history (`GET /api/initiatives/:id/assessments`)
- **Deterministic Comparison Service** (`comparison_service.py`) — cross-ontology-version aware, uses frozen snapshots (D-D)
- **AI Change Explanation** — structured fact input, causal restraint enforced, deterministic fallback (INV-003, INV-004)
- **New Frontend Pages**: InitiativeOverview, RemediationWorkspace, ComparisonView
- **Report CTAs**: "Track Remediation" buttons on blockers and risk dimensions
- **CreateRemediationPlanDialog** — pre-fills finding, routes to workspace
- **Migration Script** (`scripts/migrate_initiatives.py`) — idempotent batch migration

---

## Collections & Schema

### assessments
```
id, ontology_version, initiative (snapshot), evidence, status,
initiative_id, score_snapshot, scored_at,
created_at, updated_at, completed_at
```

### reports
```
id, assessment_id, initiative_id, ontology_version, initiative,
scores, reasoning, generated_at
```

### share_links
```
id, token, assessment_id, report_id, executive_abstract,
is_active, view_count, last_viewed_at, created_at, expires_at, revoked_at
```

### initiatives (NEW)
```
id, name, business_unit, description, target_workflow,
expected_outcomes, stage, created_at, updated_at
```

### remediation_plans (NEW)
```
id, initiative_id, source_assessment_id,
source_finding: { type, ref_id, label, captured_score, captured_band },
objective, created_at, updated_at
```

### remediation_actions (NEW)
```
id, plan_id, description, owner, target_date,
status (not_started|in_progress|complete),
evidence_requirement, evidence_reference,
evidence_status (not_provided|provided),
created_at, updated_at
```

---

## Routes

### Existing
- `GET /api/health`
- `GET /api/ontology`
- `POST /api/assessments`
- `GET /api/assessments/:id`
- `PATCH /api/assessments/:id` — 409 if completed + evidence/initiative patch
- `POST /api/assessments/:id/score`
- `POST /api/assessments/:id/report` — freezes score_snapshot on first run
- `GET /api/assessments/:id/report`
- `POST /api/assessments/seed-demo`
- `GET /api/assessments/demo/current`
- `POST /api/assessments/:id/share`
- `GET /api/assessments/:id/share`
- `GET /api/shared/:token`

### New (Phase 2)
- `GET /api/initiatives/:id`
- `GET /api/initiatives/:id/assessments`
- `POST /api/initiatives/:id/reassessment`
- `POST /api/initiatives/:id/remediation-plans`
- `GET /api/initiatives/:id/remediation-plans`
- `GET /api/remediation-plans/:id`
- `POST /api/remediation-plans/:id/actions`
- `PATCH /api/remediation-actions/:id`
- `GET /api/initiatives/:id/comparison?from=X&to=Y`
- `POST /api/initiatives/:id/comparison/explanation`

---

## Frontend Routes
- `/` — Landing
- `/assessment/:sessionId` — Intake
- `/assessment/:sessionId/evidence` — Evidence Assessment
- `/report/:sessionId` — Executive Briefing
- `/shared/:token` — Shared Briefing (read-only)
- `/initiative/:initiativeId` — Initiative Overview (NEW)
- `/initiative/:initiativeId/remediation/:planId` — Remediation Workspace (NEW)
- `/initiative/:initiativeId/comparison` — Comparison View (NEW)

---

## Invariants (Must Never Be Violated)
- **INV-001**: Completed assessment evidence + initiative snapshot are immutable
- **INV-002**: Readiness scores may only change via deterministic scoring; remediation/LLM cannot alter them
- **INV-003**: DIE may describe observed changes; may never claim remediation caused score movement
- **INV-004**: LLM failure must not break comparison, remediation tracking, or reassessment

---

## P0/P1/P2 Backlog

### P0 — Deployment
- [ ] Fix `.gitignore` to allow `.env` tracking → re-run Deployment Agent

### P1 — Next Sprint
- [ ] `/api/score/preview` — "what-if" sandbox endpoint for analysts
- [ ] Authentication + user login (Phase 3)

### P2 — Future
- [ ] CRA → Vite migration
- [ ] Clean up unused Shadcn UI components (`/app/frontend/src/components/ui/`)
- [ ] Report narrative version history (optional audit log)
- [ ] Split `server.py` into separate route modules as it approaches 800+ lines
