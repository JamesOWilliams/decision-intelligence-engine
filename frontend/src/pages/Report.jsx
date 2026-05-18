import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Printer, ArrowLeft, Loader2, Share2 } from "lucide-react";
import TopNav from "@/components/TopNav";
import ShareBriefingDialog from "@/components/ShareBriefingDialog";
import ReportHeader from "@/components/report/ReportHeader";
import ScoreHero from "@/components/report/ScoreHero";
import InitiativeSummary from "@/components/report/InitiativeSummary";
import {
  DimensionBreakdownSection,
  BlockersSection,
  StrengthsRisksSection,
  RemediationSection,
} from "@/components/report/ReportSections";
import { api } from "@/lib/api";
import { log } from "@/lib/logger";

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
          log.error(e);
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
        <ReportHeader
          initiative={initiative}
          generated_at={generated_at}
          leadEyebrow="Executive Operational Readiness Briefing"
          trailingEyebrow={`Ontology v${ontology_version}`}
        />

        <ScoreHero scores={scores} narrative={reasoning?.narrative} />

        <InitiativeSummary
          description={initiative.description}
          expectedOutcomes={initiative.expected_outcomes}
        />

        <DimensionBreakdownSection dimensions={scores.dimensions} />

        <BlockersSection blockers={scores.triggered_blockers} />

        <StrengthsRisksSection
          strengths={reasoning?.strengths || []}
          risks={reasoning?.risks || []}
          testIds={{ strengths: "strengths-list", risks: "risks-list" }}
        />

        <RemediationSection
          actions={reasoning?.remediation_actions || []}
          testId="remediation-list"
        />

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
