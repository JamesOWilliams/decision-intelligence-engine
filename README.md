# Decision Intelligence Engine — Organizational Readiness MVP

> An enterprise operational readiness instrument for AI initiatives.
> Evidence-driven scoring, ontology-weighted evaluation, blocker-aware recommendations,
> and Claude-generated consultative executive briefings.

**Not** a chatbot. **Not** a generic scoring tool. An *instrument* for enterprise leadership
to evaluate whether an AI initiative can realistically be executed, absorbed, and sustained.

---
## 1. Vision
Decision Intelligence Engine (DIE Orbit)

Decision Intelligence Engine (DIE Orbit) is a structured organizational readiness platform designed to help teams evaluate whether an initiative is operationally prepared for successful execution.

Traditional readiness assessments often rely on static surveys, subjective interpretation, and disconnected reporting. DIE Orbit introduces a deterministic scoring framework that transforms organizational signals into explainable readiness intelligence.

The platform combines:

weighted maturity modeling
ontology-driven assessment domains
deterministic scoring logic
executive-ready reporting
structured remediation guidance

The result is a system designed to support:

AI transformation initiatives
enterprise modernization programs
operational change readiness
governance evaluation
pilot-to-production decision making

DIE Orbit is intentionally architected with a deterministic core first, allowing explainable and auditable scoring before future AI augmentation layers are introduced.


## 2. Problem

Organizations frequently launch transformation initiatives before operational conditions are mature enough to support successful execution.

This creates recurring failure patterns:

unclear ownership
weak governance structures
fragmented operational alignment
insufficient change management maturity
low institutional readiness
inconsistent stakeholder coordination
disconnected executive visibility

Most readiness assessments fail because they:

rely on subjective interpretation
lack standardized scoring logic
produce non-repeatable outcomes
generate static reports without actionable guidance
provide little transparency into how conclusions were reached

As AI adoption accelerates, this problem becomes more severe.

Enterprises now require systems that can:

evaluate operational maturity consistently
explain scoring outcomes clearly
identify organizational risks early
support governance and compliance expectations
provide structured remediation pathways
scale from pilot experimentation to production deployment

DIE Orbit was created to address this gap.

## 3. Why Traditional Readiness Assessments Fail

Most organizational readiness assessments operate as static questionnaires rather than operational intelligence systems.

Common weaknesses include:

Traditional Assessment Weakness	Operational Impact
Subjective evaluator interpretation	Inconsistent outcomes
Generic scoring frameworks	Low contextual accuracy
Spreadsheet-driven assessments	Limited scalability
No explainability layer	Low executive trust
Weak remediation guidance	No actionable next steps
Static reporting outputs	Poor operational alignment
One-time assessments	No maturity progression tracking

These approaches often produce:

executive ambiguity
low stakeholder confidence
governance blind spots
failed pilot initiatives
stalled transformation programs

DIE Orbit approaches readiness differently.

Instead of treating assessment as a form submission process, the platform treats organizational input as structured operational data that can be:

modeled
weighted
interpreted
explained
benchmarked
operationalized

This creates a more transparent and repeatable decision-support system.

## 4. DIE Orbit Solution

DIE Orbit is a deterministic decision intelligence platform that evaluates organizational readiness across weighted operational domains.

The MVP currently focuses on Organizational Readiness scoring through five core dimensions:

Change Management Maturity
Executive Alignment
Data & Governance Readiness
Operational Enablement
Risk & Dependency Visibility

Users complete a structured intake and assessment workflow that feeds a deterministic scoring engine.

The platform then generates:

weighted readiness scores
maturity classifications
risk indicators
executive briefing summaries
remediation recommendations
pilot readiness guidance

Core platform characteristics include:

Deterministic Scoring Engine

The scoring system is intentionally rule-based and explainable. Outputs remain consistent for identical inputs, enabling transparency and auditability.

Explainable Decision Outputs

Every readiness classification is traceable to weighted domain scoring rather than opaque AI-generated conclusions.

Executive-Oriented UX

The interface is designed to resemble enterprise strategy tooling rather than consumer survey software.

Modular Architecture

The platform separates:

frontend experience
scoring orchestration
reasoning services
future AI augmentation layers

This enables future expansion into:

adaptive assessments
AI-assisted remediation generation
organizational benchmarking
longitudinal maturity tracking
multi-tenant governance workflows

DIE Orbit is designed as both:

a working MVP
and a foundation for production-grade enterprise decision intelligence systems.
## ✦ What This Is

The Decision Intelligence Engine (DIE) evaluates the **Organizational Readiness** of an AI
initiative across five weighted dimensions:

| # | Dimension                          | Weight |
|---|------------------------------------|--------|
| 1 | Change Management Maturity         | 25%    |
| 2 | Stakeholder Alignment              | 20%    |
| 3 | Operational Ownership Clarity      | 25%    |
| 4 | Cross-Functional Coordination      | 20%    |
| 5 | Training & Enablement Readiness    | 10%    |

The engine produces:
- **Domain score** (0–100) with maturity band (Minimal → Institutionalized)
- **Confidence calibration** (Low / Moderate / High) based on completeness + consistency
- **Recommendation tier** (Not Ready → Production Candidate), downgraded by triggered blockers
- **Strengths / risks / prioritized remediation actions**
- **Claude-generated consultative executive narrative**
- **Shareable boardroom briefing** with auto-generated 2–4 sentence executive abstract

### Critical architectural separation
- The **scoring engine is fully deterministic Python** — no LLM in the scoring path.
- The **LLM (Claude Sonnet 4.5) only explains** the pre-computed scores — it never alters numbers, tier, or blocker logic.

---
## Live MVP

Preview deployment (MVP):
<[click here](https://emergence-plan.emergent.host/)>

## ✦ Tech Stack

| Layer       | Technology                                                  |
|-------------|-------------------------------------------------------------|
| Frontend    | React 19 (CRA) · Tailwind CSS · react-router-dom · axios · lucide-react |
| Backend     | FastAPI · Motor (async MongoDB) · `emergentintegrations`    |
| LLM         | Anthropic Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)  |
| Persistence | MongoDB (assessments, reports, share_links collections)     |

---

## ✦ Project Structure

```
/app
├── backend/
│   ├── server.py                 # FastAPI app + all /api routes
│   ├── scoring_engine.py         # Pure deterministic scoring (decomposed helpers)
│   ├── reasoning_service.py      # Claude Sonnet 4.5 narrative + abstract
│   ├── demo_seed.py              # Seeded "Enterprise AI Knowledge Assistant Rollout"
│   ├── ontology/
│   │   └── organizational_readiness_v1.json
│   ├── tests/
│   │   └── test_die_backend.py   # 25 pytest cases (deterministic + LLM + share)
│   ├── requirements.txt
│   └── .env                      # MONGO_URL, DB_NAME, CORS_ORIGINS, EMERGENT_LLM_KEY
├── frontend/
│   ├── src/
│   │   ├── App.js                # Routes
│   │   ├── index.css             # Design tokens + Newsreader + IBM Plex + print CSS
│   │   ├── lib/
│   │   │   ├── api.js            # Axios client
│   │   │   └── logger.js         # Production-aware console wrapper
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Intake.jsx
│   │   │   ├── Assessment.jsx
│   │   │   ├── Report.jsx
│   │   │   └── SharedBriefing.jsx
│   │   └── components/
│   │       ├── TopNav.jsx
│   │       ├── MaturitySelector.jsx
│   │       ├── ReportPrimitives.jsx     # MaturityBandBadge, ConfidenceChip, ...
│   │       ├── ShareBriefingDialog.jsx
│   │       └── report/
│   │           ├── ReportHeader.jsx
│   │           ├── ScoreHero.jsx
│   │           ├── InitiativeSummary.jsx
│   │           └── ReportSections.jsx   # Dimension / Blockers / Strengths-Risks / Remediation
│   ├── tailwind.config.js
│   ├── package.json
│   └── .env                      # REACT_APP_BACKEND_URL
├── design_guidelines.json
├── memory/
│   └── PRD.md
└── README.md
```

---

## ✦ Local Setup

### Prerequisites
- **Python** 3.11+
- **Node.js** 18+ and **Yarn**
- **MongoDB** running locally (or remote URI)
- An **Anthropic API key** *or* an Emergent Universal LLM Key

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:

```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="die_database"
CORS_ORIGINS="*"
EMERGENT_LLM_KEY="<your-emergent-universal-key-or-anthropic-key>"
```

Run the backend:

```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Health check:

```bash
curl http://localhost:8001/api/health
# → {"status":"ok","ontology_version":"1.0.0"}
```

### 2. Frontend

```bash
cd frontend
yarn install
```

Create `frontend/.env`:

```env
REACT_APP_BACKEND_URL="http://localhost:8001"
```

Run the frontend:

```bash
yarn start
```

Open <http://localhost:3000>.

> **Note:** On the Emergent preview environment, services are managed by `supervisorctl` (`sudo supervisorctl restart backend|frontend`) and `REACT_APP_BACKEND_URL` is pre-configured to the public ingress URL.

---

## ✦ Demo Flow (≈2 minutes)

A seeded scenario — **"Enterprise AI Knowledge Assistant Rollout"** — calibrated to score
**72 / Structured / Proceed to Constrained Pilot** so reviewers can see the full briefing
without filling out an assessment manually.

### Option A — Click through the demo briefing
1. Open the app at `/`.
2. Click **"View demo briefing"** (top-right or hero CTA).
3. You're routed straight to `/report/<demo-id>` showing the executive briefing.
4. Click **Share Briefing** → copy the URL → open in a new tab to see the
   boardroom-style `/shared/<token>` view (with the Claude-generated 2–4 sentence executive abstract).
5. Click **Export PDF** to invoke the `@media print` stylesheet.

### Option B — Run a new assessment end-to-end
1. Click **"Begin a new assessment"** on the landing page.
2. Fill the **Initiative Intake** form and choose a stage (Discovery / Pilot / Production Candidate).
3. Move through the **Evidence Assessment** workspace — 27 indicators across 5 dimensions, each with
   a 5-segment maturity selector (Not Started → Operationalized). The right-rail **Readiness Pulse**
   updates live as you answer.
4. At ≥70% completion, click **Generate Executive Briefing** to call the LLM and produce the report.

### Option C — Reset the seeded demo via API
```bash
curl -X POST $BACKEND_URL/api/assessments/seed-demo
```

---

## ✦ API Reference (key endpoints)

| Method | Route                                    | Purpose                                    |
|--------|------------------------------------------|--------------------------------------------|
| GET    | `/api/health`                            | Health + ontology version                  |
| GET    | `/api/ontology`                          | Active ontology (UI renders from this)     |
| POST   | `/api/assessments`                       | Create new assessment (returns session id) |
| GET    | `/api/assessments/{id}`                  | Resume session                             |
| PATCH  | `/api/assessments/{id}`                  | Autosave initiative + evidence             |
| POST   | `/api/assessments/{id}/score`            | Deterministic scoring (no LLM)             |
| POST   | `/api/assessments/{id}/report`           | Scoring + Claude reasoning (cached)        |
| GET    | `/api/assessments/{id}/report`           | Retrieve cached report                     |
| POST   | `/api/assessments/{id}/share`            | Generate or reuse share link (idempotent)  |
| GET    | `/api/assessments/{id}/share`            | Passive telemetry (no side effects)        |
| GET    | `/api/shared/{token}`                    | Public read-only briefing + abstract       |
| POST   | `/api/assessments/seed-demo`             | (Re-)seed the demo assessment              |
| GET    | `/api/assessments/demo/current`          | Get current demo id (lazy-seeds)           |

---

## ✦ Tests

The backend pytest suite covers scoring determinism, blocker logic, share idempotency,
telemetry, and LLM integration shape:

```bash
cd backend
python -m pytest tests/test_die_backend.py -v
# 25/25 passing
```

Frontend production build sanity (zero ESLint warnings expected):

```bash
cd frontend
yarn build
```

---

## ✦ Design

The interface is built as a **decision cockpit**, not a SaaS dashboard:

- **Palette**: Bone background, Ink primary, Oxblood accent — no purple gradients, no shadows
- **Type pairing**: Newsreader (serif, editorial) + IBM Plex Sans (UI) + IBM Plex Mono (numerals)
- **Layout**: strict left-alignment, hairline borders, generous spacing around hero metrics
- **Print**: `@media print` stylesheet preserves the document feel for PDF export

See `design_guidelines.json` for the full token specification.

## Architectural Design Principle

The deterministic engine exists independently from future LLM orchestration.

This separation allows:

stable baseline scoring
governance validation
operational consistency
easier regression testing
future explainability comparisons against AI-assisted reasoning

This architecture reflects a broader design philosophy:

AI should augment decision systems — not replace deterministic operational foundations.
---

## ✦ Environment Variables

| Name                    | Scope    | Required | Description                                                                          |
|-------------------------|----------|----------|--------------------------------------------------------------------------------------|
| `MONGO_URL`             | Backend  | Yes      | MongoDB connection string (e.g. `mongodb://localhost:27017`)                         |
| `DB_NAME`               | Backend  | Yes      | MongoDB database name                                                                |
| `CORS_ORIGINS`          | Backend  | No       | Comma-separated allowed origins. Defaults to `*`. **Set explicit origins in prod**.  |
| `EMERGENT_LLM_KEY`      | Backend  | No       | Emergent Universal LLM key (or Anthropic key). If unset, narrative falls back to deterministic template. |
| `REACT_APP_BACKEND_URL` | Frontend | Yes      | Public URL of the FastAPI backend (e.g. `https://api.example.com`)                   |
| `GENERATE_SOURCEMAP`    | Frontend | No       | Set to `false` for production builds to suppress source map output                   |

Backend env lives in `backend/.env`; frontend env lives in `frontend/.env`. Both files are
git-ignored. A `.env.example` may be added to `backend/` if needed for collaborators.

---

## ✦ Security Posture (MVP)

This MVP is **intentionally unauthenticated** by product decision (see PRD). Read carefully
before any public production deployment.

### What is safe
- **No secrets in client bundle.** The frontend only knows `REACT_APP_BACKEND_URL`.
- **LLM API key** is server-side only and never appears in responses or logs.
- **Share tokens** use `secrets.token_urlsafe(32)` → ~256 bits of entropy. Brute-force enumeration is computationally infeasible.
- **Shared route is strictly read-only.** Only `GET /api/shared/:token` is reachable without an internal handle; it performs only `$inc view_count` as a side effect.
- **Transit IDs are stripped** from the `/api/shared/:token` response — recipients of a share link cannot derive the originating `assessment_id` or `report.id`.
- **No `dangerouslySetInnerHTML`** anywhere in the React tree; user-supplied initiative text is rendered as escaped text.
- **`.env` files** are explicitly excluded from git.

### What requires hardening before public production launch
- 🟡 **All `/api/assessments/:id/*` routes are unauthenticated.** Anyone with an assessment UUID can read, mutate, or regenerate the report. UUIDs are unguessable but logs/screen-shares are not. Add an auth gate before public deployment.
- 🟡 **`CORS_ORIGINS="*"` with `allow_credentials=True`** is permissive. Set explicit origins per environment.
- 🟡 **No rate limiting.** Add `slowapi` (or platform-level rate limits) on `/api/assessments/:id/report`, `/api/assessments/:id/share`, and `/api/shared/:token` before opening to the public.
- 🟡 **`POST /api/assessments/seed-demo`** is publicly callable. Gate behind an admin token (or remove) in production.
- 🟢 **Prompt-injection** via initiative free-text cannot alter scoring (deterministic) — worst case is degraded narrative quality. Acceptable for MVP.

### Data persisted
- `assessments` — initiative profile + evidence + metadata
- `reports` — scoring snapshot + LLM narrative
- `share_links` — token + executive abstract + view telemetry (`view_count`, `last_viewed_at`)

No user identities, no IP addresses, no PII are collected by design.

---

## ✦ Deployment Notes

### Pre-deploy checklist
1. Set `MONGO_URL`, `DB_NAME`, `EMERGENT_LLM_KEY`, `CORS_ORIGINS` (explicit origins, no `*`).
2. Set `REACT_APP_BACKEND_URL` to the production ingress.
3. Run `python backend/scripts/create_indexes.py` against the production database
   *(also runs idempotently at backend startup via `ensure_indexes`)*.
4. Disable the seed-demo route or gate it (see Security Posture).
5. Add rate limiting (recommended: `slowapi`) on share + report endpoints.
6. Disable source maps: `GENERATE_SOURCEMAP=false yarn build`.

### Runtime assumptions
- Python 3.11+, Node 18+, MongoDB 4.4+
- Backend memory ≤ 256 MB steady state; spikes during LLM I/O
- Cold-start latency on `/api/assessments/:id/report` is 4–8 s (single Claude call)
- Claude budget should be sized for ~1 narrative + ~1 abstract call per assessment

### MongoDB indexes
The following indexes are created idempotently at backend startup and can also be
created manually via `python backend/scripts/create_indexes.py`:

| Collection    | Key(s)                              | Unique | Purpose                                 |
|---------------|-------------------------------------|--------|-----------------------------------------|
| `assessments` | `id`                                | ✓      | Fast assessment retrieval               |
| `reports`     | `assessment_id`                     |        | Report lookup by assessment             |
| `share_links` | `token`                             | ✓      | Public share resolution                 |
| `share_links` | `assessment_id` + `is_active`       |        | Idempotent share creation               |

### Backup recommendations
- Daily snapshot of `assessments`, `reports`, `share_links`
- Retention: 30 days for MVP; revisit for production
- Restore drill: weekly during the first month post-deploy

### Health monitoring
- Liveness probe: `GET /api/health` → expects 200 + `{ "status": "ok" }`
- LLM budget: monitor `EMERGENT_LLM_KEY` consumption on the Emergent dashboard

---

## ✦ Roadmap

### Phase 1 (current — Organizational Readiness MVP) ✅
- Five-dimension organizational readiness ontology
- Deterministic scoring + Claude reasoning
- Tokenized executive briefing sharing
- Print-friendly executive report

### Phase 2 — Expand the Decision Surface
- Additional readiness domains: Strategic, Data, Technical, Governance, Operational Sustainability
- Multi-domain weighted roll-up score
- `/api/score/preview` — non-persisted what-if scoring service
- Per-indicator weighting UI

### Phase 3 — Evidence Layer
- Document ingestion (policies, runbooks, kickoff decks)
- RAG-retrieved evidence with provenance
- Suggested maturity ratings derived from document content (still confirmed by user)

### Phase 4 — Portfolio & Lifecycle
- Multi-assessment dashboard for AI initiative portfolios
- Trend tracking across re-assessments over time
- Workflow orchestration with human approval chains
- Enterprise IAM integration (SSO, role-based access)
- Briefing revocation + signed link expiration enforcement

---

## ✦ Status (MVP baseline)

- ✅ Scoring engine (deterministic) — bit-identical outputs verified
- ✅ Claude Sonnet 4.5 reasoning + boardroom executive abstract
- ✅ Full assessment flow (Landing → Intake → Evidence → Report)
- ✅ Tokenized read-only share links with executive abstract + view telemetry
- ✅ Print-friendly executive briefing
- ✅ 25/25 backend regression tests passing
- ✅ Production build clean (0 ESLint warnings)

---

## ✦ License

Internal MVP — license to be determined.
