import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer, Loader2 } from "lucide-react";
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
        {/* Document header */}
        <header className="pb-10 border-b border-ink">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Executive Operational Readiness · Confidential</div>
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

          <div className="col-span-12 md:col-span-5">
            <div className="eyebrow mb-3">Executive Reasoning</div>
            <blockquote className="font-heading text-xl md:text-2xl leading-relaxed text-ink border-l border-ink pl-6 py-1 italic">
              {reasoning?.narrative}
            </blockquote>
          </div>
        </section>

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
            <ul className="space-y-4">
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
            <ul className="space-y-4">
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
          <ol className="space-y-8">
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
