# Decision Intelligence Engine — Organizational Readiness MVP

> An enterprise operational readiness instrument for AI initiatives.
> Evidence-driven scoring, ontology-weighted evaluation, blocker-aware recommendations,
> and Claude-generated consultative executive briefings.

**Not** a chatbot. **Not** a generic scoring tool. An *instrument* for enterprise leadership
to evaluate whether an AI initiative can realistically be executed, absorbed, and sustained.

---

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
