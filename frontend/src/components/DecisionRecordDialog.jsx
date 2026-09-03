import React, { useState } from "react";
import { X, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";

/**
 * DecisionRecordDialog
 *
 * Records a human organizational decision against a completed assessment.
 * Deterministic: no LLM involvement.
 *
 * Props:
 *   open            — boolean
 *   onClose         — () => void
 *   onCreated       — (record) => void
 *   initiativeId    — string
 *   completedAssessments — [{id, score_snapshot, completed_at, ...}]
 */

const HUMAN_DECISIONS = [
  { value: "Proceed",                 label: "Proceed",                 hint: "Deploy to production / full scale." },
  { value: "Proceed with Conditions", label: "Proceed with Conditions", hint: "Move forward subject to stated conditions." },
  { value: "Defer",                   label: "Defer",                   hint: "Hold — do not progress this cycle." },
  { value: "Stop",                    label: "Stop",                    hint: "Terminate this initiative." },
];

// Maps ontology recommendation tier to its semantically aligned human decision.
const TIER_MAP = {
  "Production Candidate":          "Proceed",
  "Proceed to Constrained Pilot":  "Proceed with Conditions",
  "Remediate Before Expansion":    "Defer",
  "Discovery Only":                "Defer",
  "Not Ready":                     "Stop",
};

function dateStr(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DecisionRecordDialog({
  open,
  onClose,
  onCreated,
  initiativeId,
  completedAssessments = [],
}) {
  const [sourceId, setSourceId] = useState(
    completedAssessments[completedAssessments.length - 1]?.id || ""
  );
  const [humanDecision, setHumanDecision] = useState("");
  const [authority, setAuthority] = useState("");
  const [decisionDate, setDecisionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [rationale, setRationale] = useState("");
  const [conditions, setConditions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const selectedAssessment = completedAssessments.find((a) => a.id === sourceId);
  const snap = selectedAssessment?.score_snapshot;
  const tier = snap?.recommendation_tier;
  const mappedDecision = tier ? TIER_MAP[tier] : null;
  const variance = humanDecision && mappedDecision ? humanDecision !== mappedDecision : null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!sourceId || !humanDecision || !authority || !decisionDate) return;
    setSaving(true);
    setError(null);
    try {
      const record = await api.createDecisionRecord(initiativeId, {
        source_assessment_id: sourceId,
        human_decision: humanDecision,
        decision_authority: authority,
        decision_date: decisionDate,
        rationale: rationale.trim() || null,
        conditions: conditions.trim() || null,
      });
      onCreated?.(record);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || "Unable to record decision.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dr-dialog-title"
      data-testid="decision-record-dialog"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} aria-hidden />

      {/* Panel */}
      <div className="relative z-10 bg-bone w-full max-w-xl border border-ink shadow-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-hairline sticky top-0 bg-bone z-10">
          <div>
            <div className="eyebrow text-graphite mb-1">Organizational Decision</div>
            <h2 id="dr-dialog-title" className="display-serif text-2xl text-ink">
              Record Decision
            </h2>
          </div>
          <button onClick={onClose} className="text-graphite hover:text-ink transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Source Assessment selector */}
          <div>
            <label htmlFor="dr-source" className="eyebrow block mb-2">
              Source Assessment
            </label>
            <select
              id="dr-source"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              required
              className="w-full border border-hairline bg-bone p-2.5 text-sm text-ink focus:border-ink focus:outline-none"
              data-testid="dr-source-select"
            >
              <option value="">Select a completed assessment…</option>
              {[...completedAssessments].reverse().map((a, i) => (
                <option key={a.id} value={a.id}>
                  {`#${completedAssessments.length - i} · ${dateStr(a.completed_at)} · ${a.score_snapshot?.domain_score ?? "?"} / ${a.score_snapshot?.maturity_band ?? "?"}`}
                </option>
              ))}
            </select>
          </div>

          {/* System Recommendation display */}
          {snap && (
            <div
              className="border border-hairline p-4 bg-surface"
              data-testid="system-recommendation-display"
            >
              <div className="eyebrow text-graphite mb-3">System Recommendation</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="eyebrow text-[9px] mb-1">Overall Score</div>
                  <span className="mono-num text-3xl text-ink">{snap.domain_score}</span>
                  <span className="eyebrow text-graphite ml-2">{snap.maturity_band}</span>
                </div>
                <div>
                  <div className="eyebrow text-[9px] mb-1">Recommendation Tier</div>
                  <div className="font-body text-sm text-ink font-medium leading-snug">{tier}</div>
                  {snap.tier_downgraded && (
                    <div className="eyebrow text-[9px] text-oxblood mt-1">
                      Downgraded by active blocker
                    </div>
                  )}
                </div>
              </div>
              {snap.triggered_blockers?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-hairline">
                  <div className="eyebrow text-[9px] text-oxblood mb-1">
                    {snap.triggered_blockers.length} active blocker{snap.triggered_blockers.length !== 1 ? "s" : ""}
                  </div>
                  {snap.triggered_blockers.map((b) => (
                    <div key={b.id} className="font-body text-xs text-oxblood">{b.label}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Human Decision selector */}
          <div>
            <div className="eyebrow mb-3">Human Decision</div>
            <div className="space-y-2" data-testid="human-decision-options">
              {HUMAN_DECISIONS.map(({ value, label, hint }) => {
                const isAligned = mappedDecision === value;
                return (
                  <label
                    key={value}
                    className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                      humanDecision === value
                        ? "border-ink bg-ink/5"
                        : "border-hairline hover:border-ink"
                    }`}
                    data-testid={`dr-decision-option-${value.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    <input
                      type="radio"
                      name="humanDecision"
                      value={value}
                      checked={humanDecision === value}
                      onChange={() => setHumanDecision(value)}
                      className="mt-0.5 shrink-0"
                      required
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-body text-sm text-ink font-medium">{label}</span>
                        {snap && isAligned && (
                          <span className="mono-num text-[9px] text-moss border border-moss px-1.5 py-0.5 uppercase">
                            Aligned
                          </span>
                        )}
                      </div>
                      <div className="eyebrow text-graphite mt-0.5">{hint}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Variance notice */}
            {variance === true && (
              <div
                className="mt-3 flex items-start gap-2 border border-amber2/40 bg-amber2/5 p-3"
                data-testid="variance-notice"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber2 shrink-0 mt-0.5" />
                <div className="eyebrow text-amber2 text-[10px]">
                  Decision diverges from system recommendation ({tier} → {mappedDecision}).
                  This is permitted and recorded for audit purposes.
                </div>
              </div>
            )}
            {variance === false && humanDecision && (
              <div
                className="mt-3 flex items-center gap-2 border border-moss/30 bg-moss/5 p-3"
                data-testid="alignment-notice"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-moss shrink-0" />
                <div className="eyebrow text-moss text-[10px]">
                  Decision aligned with system recommendation.
                </div>
              </div>
            )}
          </div>

          {/* Authority + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="dr-authority" className="eyebrow block mb-2">
                Decision Authority
              </label>
              <input
                id="dr-authority"
                type="text"
                value={authority}
                onChange={(e) => setAuthority(e.target.value)}
                required
                placeholder="Name or role"
                className="w-full border border-hairline bg-bone p-2.5 text-sm text-ink focus:border-ink focus:outline-none"
                data-testid="dr-authority-input"
              />
            </div>
            <div>
              <label htmlFor="dr-date" className="eyebrow block mb-2">
                Decision Date
              </label>
              <input
                id="dr-date"
                type="date"
                value={decisionDate}
                onChange={(e) => setDecisionDate(e.target.value)}
                required
                className="w-full border border-hairline bg-bone p-2.5 text-sm text-ink focus:border-ink focus:outline-none"
                data-testid="dr-date-input"
              />
            </div>
          </div>

          {/* Rationale */}
          <div>
            <label htmlFor="dr-rationale" className="eyebrow block mb-2">
              Rationale <span className="text-graphite">(optional)</span>
            </label>
            <textarea
              id="dr-rationale"
              rows={3}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why was this decision made?"
              className="w-full border border-hairline bg-bone p-2.5 text-sm text-ink focus:border-ink focus:outline-none resize-none"
              data-testid="dr-rationale-input"
            />
          </div>

          {/* Conditions — only visible for "Proceed with Conditions" */}
          {humanDecision === "Proceed with Conditions" && (
            <div>
              <label htmlFor="dr-conditions" className="eyebrow block mb-2">
                Conditions
              </label>
              <textarea
                id="dr-conditions"
                rows={3}
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder="State the conditions that must be met…"
                className="w-full border border-hairline bg-bone p-2.5 text-sm text-ink focus:border-ink focus:outline-none resize-none"
                data-testid="dr-conditions-input"
              />
            </div>
          )}

          {error && (
            <div className="eyebrow text-oxblood" data-testid="dr-error">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-hairline">
            <button
              type="submit"
              disabled={saving || !sourceId || !humanDecision || !authority || !decisionDate}
              data-testid="dr-submit-btn"
              className="inline-flex items-center gap-2 bg-ink text-bone px-5 py-2.5 text-sm font-medium hover:bg-graphite transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Record Decision
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-graphite hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
