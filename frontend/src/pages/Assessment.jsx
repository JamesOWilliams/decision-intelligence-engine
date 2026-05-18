import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowUpRight, HelpCircle, Loader2 } from "lucide-react";
import TopNav from "@/components/TopNav";
import MaturitySelector from "@/components/MaturitySelector";
import { api } from "@/lib/api";

export default function Assessment() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [ontology, setOntology] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [scoreSnapshot, setScoreSnapshot] = useState(null);
  const [scoring, setScoring] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingHint, setSavingHint] = useState(false);

  useEffect(() => {
    (async () => {
      const [ont, a] = await Promise.all([api.ontology(), api.getAssessment(sessionId)]);
      setOntology(ont);
      setAssessment(a);
    })();
  }, [sessionId]);

  const refreshScore = useCallback(async () => {
    try {
      setScoring(true);
      const s = await api.score(sessionId);
      setScoreSnapshot(s);
    } finally {
      setScoring(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (assessment) refreshScore();
  }, [assessment, refreshScore]);

  const dimensions = ontology?.domain?.dimensions || [];
  const activeDim = dimensions[activeIdx];

  const totalIndicators = useMemo(
    () => dimensions.reduce((acc, d) => acc + d.sub_dimensions.reduce((a, s) => a + s.indicators.length, 0), 0),
    [dimensions]
  );
  const answeredIndicators = useMemo(() => {
    const ev = assessment?.evidence || {};
    return Object.values(ev).filter((v) => v && v !== "not_started").length;
  }, [assessment]);
  const completePct = totalIndicators ? Math.round((answeredIndicators / totalIndicators) * 100) : 0;
  const canGenerate = completePct >= 70;

  const setIndicator = async (indicatorId, value) => {
    const nextEvidence = { ...(assessment.evidence || {}), [indicatorId]: value };
    setAssessment({ ...assessment, evidence: nextEvidence });
    setSavingHint(true);
    try {
      await api.patchAssessment(sessionId, { evidence: { [indicatorId]: value } });
      refreshScore();
    } finally {
      setSavingHint(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      await api.generateReport(sessionId);
      navigate(`/report/${sessionId}`);
    } catch (e) {
      console.error(e);
      setGenerating(false);
    }
  };

  if (!ontology || !assessment) {
    return (
      <div className="App">
        <TopNav />
        <div className="max-w-screen-2xl mx-auto px-12 py-16 eyebrow">Loading…</div>
      </div>
    );
  }

  return (
    <div className="App">
      <TopNav
        crumb={
          <>
            <span>Step 02</span> · <span className="text-ink">Evidence Assessment</span>
          </>
        }
        right={
          <div className="flex items-center gap-4">
            <span className="eyebrow">{savingHint ? "Saving…" : "Autosaved"}</span>
            <span className="eyebrow text-ink">{completePct}% complete</span>
          </div>
        }
      />

      <main className="max-w-screen-2xl mx-auto px-6 md:px-12 pt-10 pb-32 grid grid-cols-12 gap-8">
        {/* Left rail: dimension nav */}
        <aside className="col-span-12 md:col-span-3 md:border-r md:border-hairline md:pr-6">
          <div className="eyebrow mb-4">Readiness Dimensions</div>
          <nav className="flex md:flex-col gap-1" data-testid="dimension-nav">
            {dimensions.map((d, idx) => {
              const active = idx === activeIdx;
              const dimScore = scoreSnapshot?.dimensions?.find((x) => x.id === d.id)?.score ?? null;
              return (
                <button
                  key={d.id}
                  data-testid={`dimension-nav-${d.id}`}
                  onClick={() => setActiveIdx(idx)}
                  className={`flex items-start justify-between gap-3 w-full text-left py-3 pl-3 pr-2 transition-colors ${
                    active
                      ? "border-l-2 border-oxblood text-ink"
                      : "border-l-2 border-transparent text-slate2 hover:text-ink"
                  }`}
                >
                  <div className="flex-1">
                    <div className="mono-num text-[10px] tracking-[0.16em] uppercase opacity-70">
                      {String(idx + 1).padStart(2, "0")} · {Math.round(d.weight * 100)}%
                    </div>
                    <div className={`text-sm leading-snug mt-1 ${active ? "font-medium text-ink" : ""}`}>
                      {d.name}
                    </div>
                  </div>
                  {dimScore !== null && (
                    <span className={`mono-num text-sm ${active ? "text-ink" : "text-slate2"}`}>
                      {dimScore}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-10 pt-6 border-t border-hairline">
            <div className="eyebrow mb-2">Progress</div>
            <div className="h-1 bg-hairline">
              <div className="h-full bg-ink transition-all duration-500" style={{ width: `${completePct}%` }} />
            </div>
            <div className="mt-2 mono-num text-xs text-graphite">
              {answeredIndicators} / {totalIndicators} indicators
            </div>
          </div>
        </aside>

        {/* Center: dimension */}
        <section className="col-span-12 md:col-span-6 animate-fade-in" key={activeDim.id}>
          <div className="eyebrow">{`Dimension ${String(activeIdx + 1).padStart(2, "0")} · Weight ${Math.round(
            activeDim.weight * 100
          )}%`}</div>
          <h1 className="display-serif text-4xl md:text-5xl mt-3">{activeDim.name}</h1>
          <p className="font-body text-base text-graphite leading-relaxed mt-5 max-w-3xl">
            {activeDim.operational_definition}
          </p>

          <div className="mt-12 space-y-10">
            {activeDim.sub_dimensions.map((sub) => (
              <div key={sub.id} className="border border-hairline bg-surface p-8" data-testid={`sub-dim-${sub.id}`}>
                <div className="flex items-baseline justify-between border-b border-hairline pb-4">
                  <h3 className="font-heading text-2xl text-ink">{sub.name}</h3>
                  <span className="eyebrow">{sub.indicators.length} indicator{sub.indicators.length > 1 ? "s" : ""}</span>
                </div>
                <div className="mt-6 space-y-8">
                  {sub.indicators.map((ind) => {
                    const value = assessment.evidence?.[ind.id] || "not_started";
                    return (
                      <div key={ind.id}>
                        <div className="flex items-start gap-2 mb-3">
                          <div className="flex-1">
                            <div className="font-body text-sm font-medium text-ink leading-snug">
                              {ind.label}
                            </div>
                            <div className="text-xs text-graphite mt-1 flex items-start gap-1.5 leading-relaxed">
                              <HelpCircle className="w-3 h-3 mt-0.5 text-slate2 shrink-0" strokeWidth={1.5} />
                              <span>{ind.help_text}</span>
                            </div>
                          </div>
                        </div>
                        <MaturitySelector
                          value={value}
                          onChange={(v) => setIndicator(ind.id, v)}
                          indicatorId={ind.id}
                          scale={ontology.maturity_scale}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Dimension nav footer */}
          <div className="mt-12 pt-8 border-t border-hairline flex items-center justify-between">
            <button
              data-testid="prev-dim-btn"
              onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))}
              disabled={activeIdx === 0}
              className="eyebrow disabled:opacity-30 hover:text-ink transition-colors"
            >
              ← Previous dimension
            </button>
            {activeIdx < dimensions.length - 1 ? (
              <button
                data-testid="next-dim-btn"
                onClick={() => setActiveIdx(activeIdx + 1)}
                className="group inline-flex items-center gap-2 text-ink border border-ink px-5 py-2.5 text-sm font-medium hover:bg-ink hover:text-bone transition-colors"
              >
                Next dimension <ArrowUpRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                data-testid="generate-report-btn"
                onClick={generate}
                disabled={!canGenerate || generating}
                className="group inline-flex items-center gap-3 bg-ink text-bone px-6 py-3.5 font-medium text-[15px] hover:bg-graphite transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating briefing…
                  </>
                ) : (
                  <>
                    Generate Executive Briefing
                    <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </>
                )}
              </button>
            )}
          </div>
          {!canGenerate && activeIdx === dimensions.length - 1 && (
            <p className="mt-3 text-xs text-graphite text-right">
              Generate available at 70%+ completion. Currently {completePct}%.
            </p>
          )}
        </section>

        {/* Right rail: live pulse */}
        <aside className="col-span-12 md:col-span-3 md:pl-6 md:border-l md:border-hairline">
          <div className="eyebrow mb-4">Readiness Pulse</div>

          <div className="border border-ink p-5 bg-surface">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Domain</span>
              {scoring && <Loader2 className="w-3 h-3 animate-spin text-slate2" />}
            </div>
            <div className="mono-num text-5xl text-ink leading-none mt-2">
              {scoreSnapshot?.domain_score ?? 0}
              <span className="text-base text-slate2 ml-1">/100</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 border border-ink mono-num text-[10px] uppercase tracking-[0.14em]">
                {scoreSnapshot?.maturity_band || "—"}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-graphite mono-num text-[10px] uppercase tracking-[0.14em] text-graphite">
                {scoreSnapshot?.confidence || "—"}
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="eyebrow">Dimension Snapshot</div>
            {(scoreSnapshot?.dimensions || []).map((d) => (
              <div key={d.id}>
                <div className="flex items-center justify-between text-xs">
                  <span className={d.score >= 50 ? "text-ink" : "text-oxblood"}>{d.name}</span>
                  <span className="mono-num">{d.score}</span>
                </div>
                <div className="h-1 bg-hairline mt-1.5">
                  <div
                    className={`h-full transition-all duration-500 ${
                      d.score >= 75 ? "bg-ink" : d.score >= 50 ? "bg-graphite" : "bg-oxblood"
                    }`}
                    style={{ width: `${d.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {scoreSnapshot?.triggered_blockers?.length > 0 && (
            <div className="mt-8 pt-6 border-t border-hairline">
              <div className="eyebrow text-oxblood mb-3">Active Blockers</div>
              <ul className="space-y-2">
                {scoreSnapshot.triggered_blockers.map((b) => (
                  <li key={b.id} className="text-xs text-ink border-l-2 border-oxblood pl-3">
                    {b.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-hairline">
            <div className="eyebrow mb-2">Recommendation Tier</div>
            <div className="text-sm text-ink leading-snug">
              {scoreSnapshot?.recommendation_tier || "—"}
            </div>
            <p className="text-xs text-slate2 mt-2 leading-relaxed">
              Live deterministic preview. Final briefing requires LLM reasoning generation.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
