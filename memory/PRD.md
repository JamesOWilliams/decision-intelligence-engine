# Decision Intelligence Engine — Organizational Readiness MVP

## Original Problem Statement
Build an enterprise operational assessment system to evaluate whether AI initiatives are organizationally ready to move from experimentation to pilot and production delivery. Evidence-based operational signals, ontology-driven evaluation logic, weighted scoring, blocker logic, confidence scoring, and Claude-generated consultative executive reasoning. NOT a chatbot. An instrument for enterprise leadership.

## Architecture
- **Frontend**: React (CRA) + Tailwind + lucide-react. Routes: `/` (Landing), `/assessment/:id` (Intake), `/assessment/:id/evidence` (Assessment workspace), `/report/:id` (Executive briefing). Session resume via URL.
- **Backend**: FastAPI + Motor (MongoDB). All routes prefixed `/api`. Deterministic scoring engine (`scoring_engine.py`) is separate from LLM reasoning (`reasoning_service.py`) — LLM only explains numbers, never alters them.
- **Ontology**: Versioned JSON at `/app/backend/ontology/organizational_readiness_v1.json` — 5 dimensions, 27 indicators, 5-level maturity scale, weighted dimension config, 5 blocker rules.
- **LLM**: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via `emergentintegrations` library + Emergent Universal LLM Key. Deterministic fallback narrative on failure.
- **Persistence**: MongoDB collections — `assessments`, `reports`.

## User Personas
- AI Centers of Excellence (CoEs)
- Product / Digital Product Owners
- Enterprise Transformation Offices
- Innovation, Governance & Risk teams
- Executive stakeholders (briefing audience)

## Core Requirements (Static)
1. Structured operational evidence intake (NOT self-scoring)
2. Ontology-driven weighted scoring (0–100)
3. Confidence calibration (Low / Moderate / High)
4. Blocker logic that can downgrade recommendation tier independent of score
5. Consultative LLM-generated executive narrative
6. Print/PDF-friendly executive briefing
7. No auth in MVP; session resume via URL

## What's Been Implemented (Jan 2026)
- ✅ Versioned ontology JSON (5 dimensions, 27 evidence indicators, 5 blockers)
- ✅ Deterministic scoring engine with weighted aggregation, confidence derivation, blocker override logic
- ✅ Claude Sonnet 4.5 reasoning service with structured JSON output + schema validation + deterministic fallback
- ✅ FastAPI routes: `/health`, `/ontology`, `/assessments` (CRUD), `/assessments/:id/score`, `/assessments/:id/report`, `/assessments/seed-demo`, `/assessments/demo/current`
- ✅ Seeded demo: "Enterprise AI Knowledge Assistant Rollout" → score 72 / Structured / Proceed to Constrained Pilot
- ✅ Landing page (executive hero, briefing sample preview, 3-step process strip, philosophy section)
- ✅ Intake page (multi-field structured form, segmented Stage control, autosave, sticky right rail timeline)
- ✅ Assessment workspace (left dimension nav with live dim scores, 5-segment cumulative maturity selectors, right rail Readiness Pulse, progress tracking)
- ✅ Executive Report (score hero, MaturityBandBadge, ConfidenceChip, RecommendationPill with tier-tone coloring, dimension breakdown bars, blocker callouts, strengths/risks two-column, prioritized remediation list, italic reasoning pull-quote, methodology accordion, browser-print Export PDF with `@media print` stylesheet)
- ✅ Design system: Bone (#F4F4F0) + Ink (#0A0A0A) + Oxblood (#7F1D1D) accent; Newsreader serif + IBM Plex Sans/Mono pairing; hairline borders, zero shadows, strict left-alignment
- ✅ data-testid on every interactive + key informational element
- ✅ Full test coverage — backend pytest suite (13/13) at `/app/backend/tests/test_die_backend.py`, frontend Playwright e2e all-green

## Tech Stack
- Frontend: React 19, Tailwind 3, react-router-dom 7, axios, lucide-react
- Backend: FastAPI, Motor (async MongoDB), emergentintegrations
- LLM: Anthropic Claude Sonnet 4.5 via Emergent Universal Key

## Prioritized Backlog
### P1 (Polish — defer until user feedback)
- Surface error toasts in Landing/Intake/Assessment on API failure (currently console-only)
- Tighten Report.jsx auto-generate fallback — explicit user action instead of auto-trigger on 404
- Granular per-indicator weighting in ontology (structure ready; UI for editing weights deferred)

### P2 (Phase 2 — PRD §22)
- Additional ontology domains: Strategic Readiness, Data Readiness, Technical Readiness, Governance Readiness, Operational Sustainability
- Multi-domain weighted roll-up
- Document ingestion + RAG-retrieved evidence
- Portfolio dashboard (multi-assessment comparison)

### P3 (Phase 3-4)
- Workflow orchestration with human approval chains
- Historical trend tracking + AI initiative portfolio management
- Enterprise IAM integration

## Next Tasks
- Await user feedback on demo experience
- Address P1 polish items based on feedback signal
- Begin Phase 2 ontology expansion (Data Readiness most likely first)

## Key File Paths
- Ontology: `/app/backend/ontology/organizational_readiness_v1.json`
- Scoring: `/app/backend/scoring_engine.py`
- Reasoning: `/app/backend/reasoning_service.py`
- Demo seed: `/app/backend/demo_seed.py`
- Server: `/app/backend/server.py`
- Frontend pages: `/app/frontend/src/pages/{Landing,Intake,Assessment,Report}.jsx`
- Design tokens: `/app/design_guidelines.json`, `/app/frontend/tailwind.config.js`, `/app/frontend/src/index.css`
- Test suite: `/app/backend/tests/test_die_backend.py`
