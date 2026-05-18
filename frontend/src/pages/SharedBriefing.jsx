import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer, Loader2 } from "lucide-react";
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

/**
 * Boardroom-grade shared briefing — no editing chrome, no navigation,
 * lead element is the Claude-generated executive abstract.
 */
export default function SharedBriefing() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getShared(token);
        setData(res);
      } catch (e) {
        setError(e?.response?.data?.detail || "This shared briefing is no longer available.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="App">
        <SharedHeader />
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-24 flex items-center gap-3 text-graphite">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="eyebrow">Loading shared briefing…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="App">
        <SharedHeader />
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-24">
          <div className="eyebrow mb-3">Unavailable</div>
          <h1 className="display-serif text-4xl text-ink">{error || "Briefing not available."}</h1>
          <p className="font-body text-graphite mt-4 max-w-2xl">
            The link may have been revoked, expired, or never generated. Please request a fresh link
            from the briefing owner.
          </p>
        </div>
      </div>
    );
  }

  const { report, executive_abstract, shared_at } = data;
  const { initiative, scores, reasoning, generated_at, ontology_version } = report;

  return (
    <div className="App">
      <SharedHeader sharedAt={shared_at} />

      <main className="max-w-5xl mx-auto px-6 md:px-12 pt-10 pb-20 print-shell animate-fade-in" data-testid="shared-briefing-shell">
        <ReportHeader
          initiative={initiative}
          generated_at={generated_at}
          leadEyebrow="Executive Operational Readiness · Confidential"
          trailingEyebrow={`Ontology v${ontology_version}`}
        />

        {/* Executive Abstract — lead element */}
        <section className="mt-12 print-section" data-testid="executive-abstract">
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 md:col-span-3">
              <div className="eyebrow">Executive Abstract</div>
              <div className="mt-3 mono-num text-[10px] tracking-[0.16em] text-slate2">
                FOR BOARD-LEVEL READING
              </div>
            </div>
            <div className="col-span-12 md:col-span-9">
              <p className="font-heading text-2xl md:text-3xl text-ink leading-snug">
                {executive_abstract}
              </p>
            </div>
          </div>
        </section>

        <div className="hr-rule mt-16" />

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
        />

        <RemediationSection actions={reasoning?.remediation_actions || []} />

        {/* Document footer (also prints) */}
        <footer className="mt-24 pt-6 border-t border-ink flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="eyebrow">
            Decision Intelligence Engine · Organizational Readiness · Ontology v{ontology_version}
          </div>
          <div className="eyebrow">Confidential · Read-Only Briefing</div>
        </footer>
      </main>
    </div>
  );
}

function SharedHeader({ sharedAt }) {
  return (
    <header
      data-testid="shared-header"
      className="no-print h-16 border-b border-ink/90 flex items-center justify-between px-6 md:px-12 bg-bone"
    >
      <div className="flex items-center gap-3">
        <div className="mono-num text-[11px] tracking-[0.22em] uppercase text-graphite">
          DIE
        </div>
        <span className="text-ink">·</span>
        <span className="font-heading text-lg text-ink tracking-tight">
          Shared Executive Briefing
        </span>
        <span className="eyebrow ml-3 hidden md:inline">CONFIDENTIAL</span>
      </div>
      <div className="flex items-center gap-4">
        {sharedAt && (
          <span className="eyebrow hidden md:inline">
            Shared {new Date(sharedAt).toLocaleDateString()}
          </span>
        )}
        <button
          onClick={() => window.print()}
          data-testid="shared-print-btn"
          className="inline-flex items-center gap-2 bg-ink text-bone px-4 py-2 text-sm font-medium hover:bg-graphite transition-colors"
        >
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>
    </header>
  );
}
