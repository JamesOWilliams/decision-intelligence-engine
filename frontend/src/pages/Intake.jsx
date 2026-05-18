import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import TopNav from "@/components/TopNav";
import { api } from "@/lib/api";

const STAGES = [
  { id: "discovery", label: "Discovery" },
  { id: "pilot", label: "Pilot" },
  { id: "production_candidate", label: "Production Candidate" },
];

const FIELDS = [
  { key: "name", label: "Initiative Name", placeholder: "e.g., Enterprise AI Knowledge Assistant Rollout", type: "input" },
  { key: "business_unit", label: "Business Unit", placeholder: "e.g., Global Operations & Shared Services", type: "input" },
  { key: "description", label: "Initiative Description", placeholder: "What does the initiative do, who is impacted, and at what scale?", type: "textarea" },
  { key: "target_workflow", label: "Target Workflow / Process", placeholder: "Which operational workflow is being transformed?", type: "input" },
  { key: "expected_outcomes", label: "Expected Business Outcomes", placeholder: "Quantitative and qualitative outcomes the initiative aims to deliver.", type: "textarea" },
];

export default function Intake() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [initiative, setInitiative] = useState({
    name: "",
    business_unit: "",
    description: "",
    target_workflow: "",
    expected_outcomes: "",
    stage: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const a = await api.getAssessment(sessionId);
        setInitiative({ ...initiative, ...(a.initiative || {}) });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const onChange = (key, value) => setInitiative((p) => ({ ...p, [key]: value }));

  const onBlurSave = async () => {
    setSaving(true);
    try {
      await api.patchAssessment(sessionId, { initiative });
    } finally {
      setSaving(false);
    }
  };

  // Keep latest initiative in a ref to avoid stale-closure writes on rapid blurs
  const initiativeRef = React.useRef(initiative);
  React.useEffect(() => { initiativeRef.current = initiative; }, [initiative]);

  const canContinue = initiative.name?.trim() && initiative.business_unit?.trim() && initiative.stage;

  const continueToAssessment = async () => {
    await api.patchAssessment(sessionId, { initiative, status: "in_progress" });
    navigate(`/assessment/${sessionId}/evidence`);
  };

  return (
    <div className="App">
      <TopNav
        crumb={<><span>Step 01</span> · <span className="text-ink">Initiative Intake</span></>}
        right={<span className="eyebrow">{saving ? "Saving…" : "Autosaved"}</span>}
      />

      {loading ? (
        <div className="max-w-screen-2xl mx-auto px-6 md:px-12 py-16">
          <div className="eyebrow">Loading…</div>
        </div>
      ) : (
        <main className="max-w-screen-2xl mx-auto px-6 md:px-12 pt-12 pb-24 grid grid-cols-12 gap-8 animate-fade-in">
          {/* Left: form */}
          <section className="col-span-12 md:col-span-8">
            <div className="eyebrow mb-4">Initiative Profile</div>
            <h1 className="display-serif text-4xl md:text-5xl mb-4">
              Define the initiative under evaluation.
            </h1>
            <p className="font-body text-graphite max-w-2xl leading-relaxed">
              Capture the operational context. The system uses this profile to frame the readiness
              briefing — it does not influence scoring directly.
            </p>

            <div className="mt-12 space-y-10">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label htmlFor={f.key} className="eyebrow mb-2 block">{f.label}</label>
                  {f.type === "textarea" ? (
                    <textarea
                      id={f.key}
                      data-testid={`intake-${f.key}`}
                      rows={3}
                      value={initiative[f.key] || ""}
                      onChange={(e) => onChange(f.key, e.target.value)}
                      onBlur={onBlurSave}
                      placeholder={f.placeholder}
                      className="w-full bg-transparent border-0 border-b border-hairline focus:border-ink focus:outline-none font-body text-lg text-ink py-3 placeholder:text-slate2/60 resize-none"
                    />
                  ) : (
                    <input
                      id={f.key}
                      data-testid={`intake-${f.key}`}
                      type="text"
                      value={initiative[f.key] || ""}
                      onChange={(e) => onChange(f.key, e.target.value)}
                      onBlur={onBlurSave}
                      placeholder={f.placeholder}
                      className="w-full bg-transparent border-0 border-b border-hairline focus:border-ink focus:outline-none font-body text-lg text-ink py-3 placeholder:text-slate2/60"
                    />
                  )}
                </div>
              ))}

              <div>
                <label className="eyebrow mb-3 block">Initiative Stage</label>
                <div className="inline-flex border border-ink" role="radiogroup">
                  {STAGES.map((s) => {
                    const selected = initiative.stage === s.id;
                    return (
                      <button
                        key={s.id}
                        data-testid={`intake-stage-${s.id}`}
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          onChange("stage", s.id);
                          // immediate save since this is a discrete control
                          api.patchAssessment(sessionId, { initiative: { ...initiative, stage: s.id } });
                        }}
                        className={`px-5 py-2.5 text-sm font-medium transition-colors border-r border-ink last:border-r-0 ${
                          selected ? "bg-ink text-bone" : "bg-bone text-ink hover:bg-sunken"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-16 pt-8 border-t border-hairline flex items-center justify-between">
              <button
                onClick={() => navigate("/")}
                data-testid="intake-back-btn"
                className="eyebrow hover:text-ink transition-colors"
              >
                ← Cancel
              </button>
              <button
                onClick={continueToAssessment}
                disabled={!canContinue}
                data-testid="intake-continue-btn"
                className="group inline-flex items-center gap-3 bg-ink text-bone px-6 py-3.5 font-medium text-[15px] hover:bg-graphite transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Continue to Evidence Assessment
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </div>
          </section>

          {/* Right rail */}
          <aside className="col-span-12 md:col-span-4 md:pl-8 md:border-l md:border-hairline">
            <div className="eyebrow">What Happens Next</div>
            <ol className="mt-6 space-y-6">
              <li className="flex gap-4">
                <span className="mono-num text-xs text-slate2 mt-0.5">01</span>
                <div>
                  <div className="font-medium text-ink text-sm">Initiative Profile</div>
                  <div className="text-xs text-graphite mt-1">You are here. Capture operational context.</div>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="mono-num text-xs text-slate2 mt-0.5">02</span>
                <div>
                  <div className="font-medium text-ink text-sm">Evidence Assessment</div>
                  <div className="text-xs text-graphite mt-1">Provide operational evidence across five readiness dimensions.</div>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="mono-num text-xs text-slate2 mt-0.5">03</span>
                <div>
                  <div className="font-medium text-ink text-sm">Scoring & Reasoning</div>
                  <div className="text-xs text-graphite mt-1">Deterministic scoring with confidence calibration and blocker logic.</div>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="mono-num text-xs text-slate2 mt-0.5">04</span>
                <div>
                  <div className="font-medium text-ink text-sm">Executive Briefing</div>
                  <div className="text-xs text-graphite mt-1">Consultative recommendation with prioritized remediation actions.</div>
                </div>
              </li>
            </ol>

            <div className="mt-12 pt-8 border-t border-hairline">
              <div className="eyebrow mb-3">Session</div>
              <div className="mono-num text-xs text-graphite break-all">{sessionId}</div>
              <div className="text-xs text-slate2 mt-2 leading-relaxed">
                Bookmark this page to resume the assessment later. No authentication required.
              </div>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}
