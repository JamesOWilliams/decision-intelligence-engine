import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Printer, ArrowLeft, Loader2, Share2 } from "lucide-react";
import TopNav from "@/components/TopNav";
import ShareBriefingDialog from "@/components/ShareBriefingDialog";
import {
  MaturityBandBadge,
  ConfidenceChip,
  RecommendationPill,
  DimensionBar,
  BlockerCallout,
} from "@/components/ReportPrimitives";
import { api } from "@/lib/api";

function FormattedDate({ iso }) {
  if (!iso) return null;
  const d = new Date(iso);
  return (
    <span className="mono-num text-xs uppercase tracking-[0.14em]">
      {d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })}
    </span>
  );
}

export default function Report() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMethodology, setShowMethodology] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTelemetry, setShareTelemetry] = useState(null);

  const refreshTelemetry = React.useCallback(async () => {
    try {
      const t = await api.getShareLink(sessionId);
      setShareTelemetry(t);
    } catch {
      setShareTelemetry(null); // no active share link yet — render nothing
    }
  }, [sessionId]);

  useEffect(() => {
    refreshTelemetry();
  }, [refreshTelemetry]);

  // When the share dialog closes, refresh telemetry (a new link may have been created)
  useEffect(() => {
    if (!shareOpen) refreshTelemetry();
  }, [shareOpen, refreshTelemetry]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.getReport(sessionId);
        setReport(r);
      } catch {
        // Try to generate if missing
        try {
          const r = await api.generateReport(sessionId);
          setReport(r);
        } catch (e) {
          console.error(e);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="App">
        <TopNav />
        <div className="max-w-screen-2xl mx-auto px-12 py-24 flex items-center gap-3 text-graphite">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="eyebrow">Generating briefing…</span>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="App">
        <TopNav />
        <div className="max-w-screen-2xl mx-auto px-12 py-24">
          <div className="eyebrow">No briefing available.</div>
        </div>
      </div>
    );
  }

  const { initiative, scores, reasoning, generated_at, ontology_version } = report;

  return (
    <div className="App">
      <TopNav
        crumb={
          <>
            <span>Step 03</span> · <span className="text-ink">Executive Briefing</span>
          </>
        }
        right={
          <div className="flex items-center gap-3 no-print">
            <button
              onClick={() => navigate(-1)}
              data-testid="report-back-btn"
              className="eyebrow hover:text-ink transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <button
              onClick={() => setShareOpen(true)}
              data-testid="share-briefing-btn"
              className="inline-flex items-center gap-2 border border-ink text-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-bone transition-colors"
            >
              <Share2 className="w-4 h-4" /> Share Briefing
            </button>
            <button
              onClick={() => window.print()}
              data-testid="export-pdf-btn"
              className="inline-flex items-center gap-2 bg-ink text-bone px-4 py-2 text-sm font-medium hover:bg-graphite transition-colors"
            >
              <Printer className="w-4 h-4" /> Export PDF
            </button>
          </div>
        }
      />

      {/* Passive executive telemetry — only renders when the briefing has actually circulated */}
      {shareTelemetry && shareTelemetry.view_count > 0 && (
        <div className="no-print max-w-5xl mx-auto px-6 md:px-12 pt-3 flex justify-end">
          <div
            data-testid="share-telemetry"
            className="eyebrow text-slate2 inline-flex items-center gap-2"
          >
            <span className="w-1 h-1 rounded-full bg-slate2/70" aria-hidden />
            <span>
              Viewed <span className="mono-num text-ink">{shareTelemetry.view_count}</span>{" "}
              {shareTelemetry.view_count === 1 ? "time" : "times"}
              {shareTelemetry.last_viewed_at && (
                <>
                  {" · Last opened "}
                  <span className="mono-num text-ink">
                    {new Date(shareTelemetry.last_viewed_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                    })}
                  </span>
                </>
              )}
            </span>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 md:px-12 pt-12 pb-24 print-shell animate-fade-in" data-testid="report-shell">
        {/* Document header */}
        <header className="pb-10 border-b border-ink">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Executive Operational Readiness Briefing</div>
            <div className="eyebrow">
              <FormattedDate iso={generated_at} /> · Ontology v{ontology_version}
            </div>
          </div>
          <h1 className="display-serif text-4xl md:text-6xl mt-6">
            {initiative.name || "Untitled Initiative"}
          </h1>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="eyebrow mb-1">Business Unit</div>
              <div className="text-ink">{initiative.business_unit || "—"}</div>
            </div>
            <div>
              <div className="eyebrow mb-1">Initiative Stage</div>
              <div className="text-ink capitalize">
                {(initiative.stage || "—").replace(/_/g, " ")}
              </div>
            </div>
            <div>
              <div className="eyebrow mb-1">Target Workflow</div>
              <div className="text-ink">{initiative.target_workflow || "—"}</div>
            </div>
          </div>
        </header>

        {/* Score hero */}
        <section className="grid grid-cols-12 gap-8 mt-12 print-section">
          <div className="col-span-12 md:col-span-7">
            <div className="eyebrow">Organizational Readiness</div>
            <div className="flex items-baseline gap-3 mt-3">
              <span
                data-testid="score-hero-numeral"
                className="mono-num text-[7.5rem] md:text-[10rem] leading-none text-ink tracking-tighter print-hero-numeral"
              >
                {scores.domain_score}
              </span>
              <span className="mono-num text-2xl text-slate2">/ 100</span>
            </div>
            <div className="mt-6 flex items-center gap-3 flex-wrap">
              <MaturityBandBadge band={scores.maturity_band} />
              <ConfidenceChip confidence={scores.confidence} />
            </div>
            <div className="mt-6">
              <div className="eyebrow mb-2">Recommendation</div>
              <RecommendationPill tier={scores.recommendation_tier} />
              {scores.tier_downgraded && (
                <div className="mt-2 text-xs text-oxblood">
                  Tier downgraded from <span className="font-medium">{scores.raw_tier_before_blockers}</span> due to active blockers.
                </div>
              )}
            </div>
          </div>

          {/* Reasoning pull-quote */}
          <div className="col-span-12 md:col-span-5">
            <div className="eyebrow mb-3">Executive Reasoning</div>
            <blockquote
              data-testid="reasoning-narrative"
              className="font-heading text-xl md:text-2xl leading-relaxed text-ink border-l border-ink pl-6 py-1 italic"
            >
              {reasoning?.narrative}
            </blockquote>
          </div>
        </section>

        {/* Initiative summary */}
        {initiative.description && (
          <section className="mt-16 print-section">
            <div className="eyebrow mb-3">Initiative Summary</div>
            <p className="font-body text-base text-ink leading-relaxed max-w-4xl">
              {initiative.description}
            </p>
            {initiative.expected_outcomes && (
              <p className="font-body text-sm text-graphite leading-relaxed max-w-4xl mt-4">
                <span className="eyebrow mr-2">Expected Outcomes</span>
                {initiative.expected_outcomes}
              </p>
            )}
          </section>
        )}

        {/* Dimension breakdown */}
        <section className="mt-20 print-section">
          <div className="flex items-baseline justify-between border-b border-ink pb-4 mb-6">
            <h2 className="display-serif text-3xl">Dimension Breakdown</h2>
            <div className="eyebrow">5 dimensions · weighted</div>
          </div>
          <div>
            {scores.dimensions.map((d) => (
              <DimensionBar key={d.id} name={d.name} weight={d.weight} score={d.score} band={d.band} />
            ))}
          </div>
        </section>

        {/* Blockers */}
        {scores.triggered_blockers?.length > 0 && (
          <section className="mt-20 print-section">
            <div className="flex items-baseline justify-between border-b border-oxblood pb-4 mb-6">
              <h2 className="display-serif text-3xl text-oxblood">Operational Blockers</h2>
              <div className="eyebrow text-oxblood">
                {scores.triggered_blockers.length} active · downgrades recommendation
              </div>
            </div>
            <div className="space-y-4">
              {scores.triggered_blockers.map((b) => (
                <BlockerCallout key={b.id} blocker={b} />
              ))}
            </div>
          </section>
        )}

        {/* Strengths & Risks */}
        <section className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-12 print-section">
          <div>
            <div className="border-b border-ink pb-4 mb-6">
              <h2 className="display-serif text-3xl">Organizational Strengths</h2>
            </div>
            <ul data-testid="strengths-list" className="space-y-4">
              {(reasoning?.strengths || []).map((s, i) => (
                <li key={i} className="flex gap-4">
                  <span className="mono-num text-xs text-slate2 mt-1.5">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-ink leading-relaxed text-[15px]">{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="border-b border-ink pb-4 mb-6">
              <h2 className="display-serif text-3xl">Operational Risks</h2>
            </div>
            <ul data-testid="risks-list" className="space-y-4">
              {(reasoning?.risks || []).map((r, i) => (
                <li key={i} className="flex gap-4">
                  <span className="mono-num text-xs text-oxblood mt-1.5">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-ink leading-relaxed text-[15px]">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Remediation */}
        <section className="mt-20 print-section">
          <div className="flex items-baseline justify-between border-b border-ink pb-4 mb-8">
            <h2 className="display-serif text-3xl">Prioritized Remediation Actions</h2>
            <div className="eyebrow">Sequenced by impact</div>
          </div>
          <ol data-testid="remediation-list" className="space-y-8">
            {(reasoning?.remediation_actions || []).map((a, i) => (
              <li key={i} className="grid grid-cols-12 gap-6">
                <div className="col-span-2 md:col-span-1">
                  <span className="mono-num text-3xl text-ink">{a.priority || i + 1}</span>
                </div>
                <div className="col-span-10 md:col-span-11">
                  <div className="font-heading text-xl text-ink leading-snug">{a.action}</div>
                  <div className="text-sm text-graphite mt-2 leading-relaxed">{a.rationale}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Methodology accordion */}
        <section className="mt-24 border-t border-hairline pt-6 no-print">
          <button
            onClick={() => setShowMethodology((v) => !v)}
            data-testid="methodology-toggle"
            className="eyebrow w-full text-left flex items-center justify-between hover:text-ink transition-colors"
          >
            <span>Methodology & Scoring Logic</span>
            <span className="mono-num">{showMethodology ? "−" : "+"}</span>
          </button>
          {showMethodology && (
            <div className="font-body text-sm text-graphite pt-4 space-y-3 leading-relaxed max-w-4xl">
              <p>
                Each evidence indicator is rated on a five-level maturity scale (Not Started, Informal, Drafted, Approved, Operationalized).
                Indicator scores are weighted and aggregated into sub-dimension and dimension scores. Dimensions are weighted into a single domain score:
                Change Management 25%, Stakeholder Alignment 20%, Operational Ownership 25%, Cross-Functional Coordination 20%, Training & Enablement 10%.
              </p>
              <p>
                Confidence is derived from evidence completeness, average indicator maturity, and consistency of dimension scores.
                The system overrides recommendation tiers when operational blockers are triggered — production-blocking gaps cap the recommendation at
                "Remediate Before Expansion," and missing escalation paths cap it at "Constrained Pilot."
              </p>
              <p>
                The deterministic engine produces the score and tier. The reasoning layer (Claude Sonnet 4.5) explains them in consultative language;
                it does not alter the numerical outputs.
              </p>
            </div>
          )}
        </section>

        {/* Print-only footer */}
        <footer className="mt-20 pt-6 border-t border-ink print-show-only text-xs text-graphite">
          Decision Intelligence Engine · Organizational Readiness · Ontology v{ontology_version}
        </footer>
      </main>

      <ShareBriefingDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        assessmentId={sessionId}
      />
    </div>
  );
}
