import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, FileText, LineChart, ListChecks } from "lucide-react";
import TopNav from "@/components/TopNav";
import { api } from "@/lib/api";

const STEPS = [
  {
    n: "01",
    icon: ListChecks,
    title: "Evidence Intake",
    body: "Operational signals across five readiness dimensions — captured as evidence, not self-scored.",
  },
  {
    n: "02",
    icon: LineChart,
    title: "Deterministic Scoring",
    body: "Weighted ontology-driven evaluation with confidence calibration and blocker logic.",
  },
  {
    n: "03",
    icon: FileText,
    title: "Executive Briefing",
    body: "Consultative recommendation, dimension breakdown, and prioritized remediation actions.",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const beginNew = async () => {
    setBusy(true);
    try {
      const a = await api.createAssessment({});
      navigate(`/assessment/${a.id}`);
    } finally {
      setBusy(false);
    }
  };

  const openDemo = async () => {
    setBusy(true);
    try {
      const d = await api.demoCurrent();
      navigate(`/report/${d.assessment_id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="App">
      <TopNav
        right={
          <button
            data-testid="nav-demo-btn"
            onClick={openDemo}
            className="eyebrow hover:text-ink transition-colors"
          >
            View demo briefing →
          </button>
        }
      />

      <main className="max-w-screen-2xl mx-auto px-6 md:px-12 pt-16 md:pt-24 pb-24">
        {/* Hero */}
        <section className="grid grid-cols-12 gap-8 animate-fade-in">
          <div className="col-span-12 md:col-span-8">
            <div className="eyebrow mb-6">
              Organizational Readiness · MVP v1.0
            </div>
            <h1
              data-testid="hero-headline"
              className="display-serif text-5xl md:text-7xl"
            >
              An operational readiness instrument
              <br />
              for enterprise <span className="italic font-light text-graphite">AI initiatives</span>.
            </h1>
            <p className="font-body text-lg text-graphite max-w-2xl mt-8 leading-relaxed">
              The Decision Intelligence Engine evaluates whether an AI initiative can realistically
              be executed, absorbed, and sustained by the organization. Evidence-driven scoring,
              governance-aware logic, explainable recommendations for executive leadership.
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-10">
              <button
                data-testid="begin-assessment-btn"
                onClick={beginNew}
                disabled={busy}
                className="group inline-flex items-center gap-3 bg-ink text-bone px-6 py-3.5 font-medium text-[15px] hover:bg-graphite transition-colors disabled:opacity-50"
              >
                Begin a new assessment
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
              <button
                data-testid="view-demo-btn"
                onClick={openDemo}
                disabled={busy}
                className="inline-flex items-center gap-3 border border-ink text-ink px-6 py-3.5 font-medium text-[15px] hover:bg-ink hover:text-bone transition-colors disabled:opacity-50"
              >
                View demo briefing
              </button>
            </div>
          </div>

          {/* Right meta column */}
          <aside className="col-span-12 md:col-span-4 md:pl-8 md:border-l md:border-hairline">
            <div className="eyebrow">Briefing Sample</div>
            <div className="mt-4 border border-ink/90 bg-surface p-6">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">Domain Score</span>
                <span className="mono-num text-xs text-slate2">/ 100</span>
              </div>
              <div className="mono-num text-6xl text-ink leading-none mt-2">72</div>
              <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-1 border border-ink mono-num text-[10px] uppercase tracking-[0.14em]">
                  Structured
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-ink mono-num text-[10px] uppercase tracking-[0.14em]">
                  Moderate
                </span>
              </div>
              <div className="mt-5 pt-5 border-t border-hairline">
                <div className="eyebrow">Recommendation</div>
                <div className="mt-2 inline-flex items-center px-3 py-1.5 bg-ink text-bone text-xs font-medium">
                  Proceed to Constrained Pilot
                </div>
              </div>
              <div className="mt-5 pt-5 border-t border-hairline space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink">Stakeholder Alignment</span>
                  <span className="mono-num text-xs text-ink">88</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink">Change Management</span>
                  <span className="mono-num text-xs text-ink">75</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink">Cross-Functional</span>
                  <span className="mono-num text-xs text-ink">75</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink">Ownership Clarity</span>
                  <span className="mono-num text-xs text-ink">70</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-oxblood">Training Readiness</span>
                  <span className="mono-num text-xs text-oxblood">35</span>
                </div>
              </div>
            </div>
          </aside>
        </section>

        {/* Process strip */}
        <section className="mt-24 md:mt-32">
          <div className="eyebrow mb-8">The Assessment Workflow</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-hairline border border-hairline">
            {STEPS.map(({ n, icon: Icon, title, body }) => (
              <div
                key={n}
                data-testid={`process-step-${n}`}
                className="bg-bone p-8 md:p-10 flex flex-col gap-6"
              >
                <div className="flex items-center justify-between">
                  <span className="mono-num text-xs text-slate2 tracking-[0.2em]">{n}</span>
                  <Icon className="w-5 h-5 text-ink" strokeWidth={1.25} />
                </div>
                <h3 className="font-heading text-2xl text-ink leading-tight">{title}</h3>
                <p className="font-body text-sm text-graphite leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Philosophy strip */}
        <section className="mt-24 md:mt-32 grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-4">
            <div className="eyebrow">Product Philosophy</div>
          </div>
          <div className="col-span-12 md:col-span-8">
            <p className="font-heading text-3xl md:text-4xl text-ink leading-snug">
              Not a chatbot. Not a scorecard. <span className="italic text-graphite">An instrument</span> for
              evaluating whether an AI initiative can be executed, absorbed, and sustained — built
              on evidence, weighted by ontology, governed by blocker logic.
            </p>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="eyebrow mb-2">The system is</div>
                <ul className="space-y-1.5 text-sm text-ink">
                  <li>— An enterprise operational assessment framework</li>
                  <li>— A governance-aware decision support system</li>
                  <li>— An evidence-driven evaluation engine</li>
                  <li>— An explainable executive recommendation platform</li>
                </ul>
              </div>
              <div>
                <div className="eyebrow mb-2">The system is not</div>
                <ul className="space-y-1.5 text-sm text-graphite">
                  <li>— A chatbot or conversational assistant</li>
                  <li>— An autonomous decision-maker</li>
                  <li>— A generic AI scoring application</li>
                  <li>— A prompt wrapper</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline px-6 md:px-12 py-6 max-w-screen-2xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="eyebrow">Decision Intelligence Engine · Organizational Readiness MVP</div>
          <div className="eyebrow">Ontology v1.0.0</div>
        </div>
      </footer>
    </div>
  );
}
