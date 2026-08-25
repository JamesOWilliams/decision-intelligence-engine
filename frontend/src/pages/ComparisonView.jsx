import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import TopNav from "@/components/TopNav";
import { MaturityBandBadge, RecommendationPill } from "@/components/ReportPrimitives";
import { api } from "@/lib/api";

function DeltaBadge({ delta }) {
  if (delta === 0) {
    return <span className="mono-num text-lg text-slate2">±0</span>;
  }
  return (
    <span className={`mono-num text-lg font-medium ${delta > 0 ? "text-moss" : "text-oxblood"}`}>
      {delta > 0 ? "+" : ""}
      {delta}
    </span>
  );
}

function DimensionTable({ dimensions }) {
  return (
    <div className="mt-6">
      {/* Header */}
      <div className="grid grid-cols-12 gap-3 pb-2 border-b border-hairline">
        <div className="col-span-4 eyebrow">Dimension</div>
        <div className="col-span-2 eyebrow text-right">Previous</div>
        <div className="col-span-2 eyebrow text-center">Change</div>
        <div className="col-span-2 eyebrow text-right">Current</div>
        <div className="col-span-2 eyebrow text-right">Band</div>
      </div>
      {dimensions.map((d) => (
        <div
          key={d.id}
          className="grid grid-cols-12 gap-3 py-4 border-b border-hairline items-center"
          data-testid={`comparison-dim-${d.id}`}
        >
          <div className="col-span-4">
            <div className="font-body text-sm text-ink">{d.name}</div>
            <div className="eyebrow mt-0.5">{d.weight != null ? `${Math.round(d.weight * 100)}%` : ""}</div>
          </div>
          <div className="col-span-2 text-right">
            <span className="mono-num text-xl text-graphite">{d.previous_score}</span>
          </div>
          <div className="col-span-2 flex justify-center">
            <DeltaBadge delta={d.delta} />
          </div>
          <div className="col-span-2 text-right">
            <span className="mono-num text-xl text-ink">{d.current_score}</span>
          </div>
          <div className="col-span-2 text-right">
            {d.previous_band !== d.current_band ? (
              <div className="text-right">
                <div className="eyebrow text-[9px] text-graphite line-through">{d.previous_band}</div>
                <div className="eyebrow text-[10px] text-ink font-medium">{d.current_band}</div>
              </div>
            ) : (
              <span className="eyebrow text-graphite">{d.current_band}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExplanationSection({ explanation, loading, error, onLoad }) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 py-8 text-graphite">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="eyebrow">Generating explanation…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6 border-l-4 border-amber2 pl-4">
        <div className="eyebrow text-amber2 mb-1">AI explanation unavailable</div>
        <p className="font-body text-sm text-graphite">{error}</p>
        <button
          onClick={onLoad}
          className="mt-3 eyebrow text-ink border border-ink px-3 py-1.5 hover:bg-ink hover:text-bone transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!explanation) {
    return (
      <div className="py-4">
        <button
          onClick={onLoad}
          data-testid="load-explanation-btn"
          className="inline-flex items-center gap-2 border border-ink text-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-bone transition-colors"
        >
          Generate Explanation
        </button>
        <p className="eyebrow text-graphite mt-2">
          AI-generated change explanation. Falls back to deterministic template if unavailable.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="comparison-explanation" className="space-y-8">
      {/* Summary */}
      <blockquote className="font-heading text-xl text-ink border-l border-ink pl-6 py-1 italic leading-relaxed">
        {explanation.summary}
      </blockquote>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        {/* Material Changes */}
        {explanation.material_changes?.length > 0 && (
          <div>
            <div className="border-b border-ink pb-4 mb-4">
              <h3 className="display-serif text-xl">Material Changes</h3>
            </div>
            <ul className="space-y-3">
              {explanation.material_changes.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mono-num text-xs text-slate2 mt-1">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-body text-sm text-ink leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Remaining Gaps */}
        {explanation.remaining_gaps?.length > 0 && (
          <div>
            <div className="border-b border-oxblood pb-4 mb-4">
              <h3 className="display-serif text-xl text-oxblood">Remaining Gaps</h3>
            </div>
            <ul className="space-y-3">
              {explanation.remaining_gaps.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mono-num text-xs text-oxblood mt-1">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-body text-sm text-ink leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComparisonView() {
  const { initiativeId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromId = searchParams.get("from");
  const toId = searchParams.get("to");

  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [explanation, setExplanation] = useState(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationError, setExplanationError] = useState(null);

  useEffect(() => {
    if (!fromId || !toId) {
      setError("Missing assessment IDs. Please select two assessments to compare.");
      setLoading(false);
      return;
    }
    let alive = true;
    api.getComparison(initiativeId, fromId, toId)
      .then((d) => { if (alive) setComparison(d); })
      .catch((e) => {
        if (alive) setError(e?.response?.data?.detail || "Unable to load comparison.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [initiativeId, fromId, toId]);

  async function loadExplanation() {
    setExplanationLoading(true);
    setExplanationError(null);
    try {
      const result = await api.getComparisonExplanation(initiativeId, fromId, toId);
      setExplanation(result.explanation);
      // Prefer the deterministic comparison from the explanation endpoint (same data)
      if (result.comparison && !comparison) setComparison(result.comparison);
    } catch (e) {
      setExplanationError(e?.response?.data?.detail || "Explanation unavailable.");
    } finally {
      setExplanationLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="App">
        <TopNav />
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-24 flex items-center gap-3 text-graphite">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="eyebrow">Loading comparison…</span>
        </div>
      </div>
    );
  }

  if (error || !comparison) {
    return (
      <div className="App">
        <TopNav />
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-24">
          <div className="eyebrow text-oxblood mb-2">{error || "Comparison unavailable."}</div>
          <Link
            to={`/initiative/${initiativeId}`}
            className="eyebrow text-ink border border-ink px-4 py-2 hover:bg-ink hover:text-bone transition-colors"
          >
            Back to Initiative
          </Link>
        </div>
      </div>
    );
  }

  const { overall, dimensions_comparable, dimensions } = comparison;
  const delta = overall.delta;

  return (
    <div className="App">
      <TopNav
        crumb={
          <>
            <Link to={`/initiative/${initiativeId}`} className="hover:text-ink transition-colors">
              Initiative
            </Link>
            <span className="mx-1">·</span>
            <span className="text-ink">Comparison</span>
          </>
        }
        right={
          <button
            onClick={() => navigate(`/initiative/${initiativeId}`)}
            className="eyebrow hover:text-ink transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3 h-3" />
            <span className="hidden sm:inline">Overview</span>
          </button>
        }
      />

      <main
        data-testid="comparison-view"
        className="max-w-5xl mx-auto px-6 md:px-12 pt-12 pb-24 animate-fade-in"
      >
        {/* Header */}
        <header className="pb-10 border-b border-ink">
          <div className="eyebrow mb-2">Assessment Comparison</div>
          <h1 className="display-serif text-4xl sm:text-5xl mt-2">
            Readiness Trajectory
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-graphite">
            <span className="eyebrow">
              Previous:{" "}
              <span className="text-ink">
                {comparison.previous_assessment?.scored_at
                  ? new Date(comparison.previous_assessment.scored_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            </span>
            <ArrowRight className="w-3 h-3 text-graphite" />
            <span className="eyebrow">
              Current:{" "}
              <span className="text-ink">
                {comparison.current_assessment?.scored_at
                  ? new Date(comparison.current_assessment.scored_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            </span>
          </div>
        </header>

        {/* Overall Score Hero */}
        <section className="mt-12 grid grid-cols-12 gap-8" data-testid="score-comparison-hero">
          {/* Previous */}
          <div className="col-span-12 md:col-span-4 text-center md:text-left">
            <div className="eyebrow text-graphite mb-3">Previous Assessment</div>
            <span
              data-testid="prev-score"
              className="mono-num text-[5rem] leading-none text-graphite tracking-tighter"
            >
              {overall.previous_score}
            </span>
            <div className="mt-3 flex flex-col gap-2 items-center md:items-start">
              <MaturityBandBadge band={overall.previous_band} />
              {overall.previous_tier && (
                <RecommendationPill tier={overall.previous_tier} />
              )}
            </div>
          </div>

          {/* Delta */}
          <div className="col-span-12 md:col-span-4 flex flex-col items-center justify-center">
            <div className="eyebrow text-graphite mb-2">Change</div>
            <div
              data-testid="score-delta"
              className={`mono-num text-5xl font-medium tracking-tighter ${
                delta > 0 ? "text-moss" : delta < 0 ? "text-oxblood" : "text-slate2"
              }`}
            >
              {delta > 0 ? "+" : ""}
              {delta}
            </div>
            {overall.maturity_transition && (
              <div
                data-testid="maturity-transition"
                className="eyebrow text-graphite mt-3 text-center"
              >
                {overall.maturity_transition}
              </div>
            )}
            {overall.tier_transition && (
              <div className="eyebrow text-[10px] text-graphite mt-1 text-center">
                {overall.tier_transition}
              </div>
            )}
          </div>

          {/* Current */}
          <div className="col-span-12 md:col-span-4 text-center md:text-right">
            <div className="eyebrow text-graphite mb-3">Current Assessment</div>
            <span
              data-testid="curr-score"
              className="mono-num text-[5rem] leading-none text-ink tracking-tighter"
            >
              {overall.current_score}
            </span>
            <div className="mt-3 flex flex-col gap-2 items-center md:items-end">
              <MaturityBandBadge band={overall.current_band} />
              {overall.current_tier && (
                <RecommendationPill tier={overall.current_tier} />
              )}
            </div>
          </div>
        </section>

        {/* Dimension Breakdown */}
        <section className="mt-20" data-testid="dimension-comparison-section">
          <div className="flex items-baseline justify-between border-b border-ink pb-4 mb-2">
            <h2 className="display-serif text-3xl">Dimension Movement</h2>
            {!dimensions_comparable && (
              <span className="eyebrow text-amber2">Not comparable</span>
            )}
          </div>

          {!dimensions_comparable && (
            <div className="mt-4 flex items-start gap-3 border border-amber2/40 bg-amber2/5 p-4">
              <AlertTriangle className="w-4 h-4 text-amber2 shrink-0 mt-0.5" />
              <div>
                <div className="eyebrow text-amber2 mb-1">Dimension Results Not Directly Comparable</div>
                <p className="font-body text-sm text-graphite leading-relaxed">
                  These assessments were scored against different ontology versions (
                  {comparison.previous_assessment?.ontology_version} vs{" "}
                  {comparison.current_assessment?.ontology_version}). Overall score comparison
                  remains valid; dimension-level comparison is suppressed.
                </p>
              </div>
            </div>
          )}

          {dimensions_comparable && dimensions.length > 0 && (
            <DimensionTable dimensions={dimensions} />
          )}
        </section>

        {/* What Changed — AI Explanation */}
        <section className="mt-20" data-testid="what-changed-section">
          <div className="border-b border-ink pb-4 mb-8">
            <h2 className="display-serif text-3xl">What Changed</h2>
            <div className="eyebrow text-graphite mt-1">
              AI-assisted interpretation · Deterministic scoring is authoritative
            </div>
          </div>
          <ExplanationSection
            explanation={explanation}
            loading={explanationLoading}
            error={explanationError}
            onLoad={loadExplanation}
          />
        </section>

        {/* Footer nav */}
        <section className="mt-16 pt-8 border-t border-hairline flex flex-wrap gap-4">
          <Link
            to={`/report/${toId}`}
            className="eyebrow text-ink border border-ink px-4 py-2 hover:bg-ink hover:text-bone transition-colors"
          >
            View Current Briefing
          </Link>
          <Link
            to={`/report/${fromId}`}
            className="eyebrow text-graphite border border-hairline px-4 py-2 hover:border-ink transition-colors"
          >
            View Previous Briefing
          </Link>
          <Link
            to={`/initiative/${initiativeId}`}
            className="eyebrow text-graphite border border-hairline px-4 py-2 hover:border-ink transition-colors"
          >
            Back to Overview
          </Link>
        </section>
      </main>
    </div>
  );
}
