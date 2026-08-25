import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Loader2, ShieldAlert, TrendingDown } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Dialog for creating a Remediation Plan anchored to a deterministic finding
 * (triggered blocker or risk dimension) from an executive briefing.
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   initiativeId: string
 *   assessmentId: string
 *   finding: {
 *     type: "blocker" | "risk"
 *     ref_id: string      — blocker.id or dimension.id
 *     label: string
 *     captured_score: number | null
 *     captured_band: string | null
 *   }
 *   suggestedObjective: string — pre-fill from LLM recommendation (display only)
 */
export default function CreateRemediationPlanDialog({
  open,
  onClose,
  initiativeId,
  assessmentId,
  finding,
  suggestedObjective = "",
}) {
  const navigate = useNavigate();
  const [objective, setObjective] = useState(suggestedObjective);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const isBlocker = finding?.type === "blocker";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!objective.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const plan = await api.createRemediationPlan(initiativeId, {
        source_assessment_id: assessmentId,
        source_finding: {
          type: finding.type,
          ref_id: finding.ref_id,
          label: finding.label,
          captured_score: finding.captured_score ?? null,
          captured_band: finding.captured_band ?? null,
        },
        objective: objective.trim(),
      });
      onClose();
      navigate(`/initiative/${initiativeId}/remediation/${plan.id}`);
    } catch (err) {
      setError(err?.response?.data?.detail || "Unable to create remediation plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rp-dialog-title"
      data-testid="create-plan-dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="relative z-10 bg-bone w-full max-w-lg border border-ink shadow-lg">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-hairline">
          <div>
            <div className="eyebrow text-graphite mb-1">Create Remediation Plan</div>
            <h2 id="rp-dialog-title" className="display-serif text-2xl text-ink">
              Track This Finding
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-graphite hover:text-ink transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Finding */}
        <div
          className={`mx-6 mt-6 border-l-4 p-4 ${
            isBlocker
              ? "border-oxblood bg-oxblood/[0.04]"
              : "border-graphite bg-sunken/30"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {isBlocker ? (
              <ShieldAlert className="w-3.5 h-3.5 text-oxblood shrink-0" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-graphite shrink-0" />
            )}
            <span
              className={`mono-num text-[9px] uppercase tracking-wider ${
                isBlocker ? "text-oxblood" : "text-graphite"
              }`}
            >
              {isBlocker ? "Operational Blocker" : "Operational Risk"}
            </span>
          </div>
          <div className="font-body text-sm text-ink font-medium leading-snug">
            {finding?.label}
          </div>
          {(finding?.captured_score != null || finding?.captured_band) && (
            <div className="mt-2 flex items-center gap-3">
              {finding.captured_score != null && (
                <span className="mono-num text-xl text-ink">{finding.captured_score}</span>
              )}
              {finding.captured_band && (
                <span className="eyebrow text-graphite">{finding.captured_band}</span>
              )}
            </div>
          )}
        </div>

        {/* Objective form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="rp-objective" className="eyebrow block mb-2">
              Remediation Objective
            </label>
            {suggestedObjective && suggestedObjective !== objective && (
              <div className="eyebrow text-[10px] text-graphite mb-2">
                Suggestion from briefing pre-filled — edit as needed
              </div>
            )}
            <textarea
              id="rp-objective"
              rows={3}
              required
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="What is the goal of this remediation effort?"
              className="w-full border border-hairline bg-bone p-3 text-sm text-ink focus:border-ink focus:outline-none resize-none"
              data-testid="plan-objective-input"
            />
          </div>

          {error && (
            <div className="eyebrow text-oxblood" data-testid="plan-create-error">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !objective.trim()}
              data-testid="create-plan-submit-btn"
              className="inline-flex items-center gap-2 bg-ink text-bone px-5 py-2.5 text-sm font-medium hover:bg-graphite transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Plan &amp; Open Workspace
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
