import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus, Loader2, Check, X } from "lucide-react";
import TopNav from "@/components/TopNav";
import { api } from "@/lib/api";

const STATUS_OPTIONS = ["not_started", "in_progress", "complete"];
const STATUS_LABELS = {
  not_started: "Not Started",
  in_progress: "In Progress",
  complete: "Complete",
};
const STATUS_COLORS = {
  not_started: "text-slate2 border-slate2",
  in_progress: "text-amber2 border-amber2",
  complete: "text-moss border-moss",
};

function ActionRow({ action, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(action);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateAction(action.id, {
        description: local.description,
        owner: local.owner,
        target_date: local.target_date,
        status: local.status,
        evidence_requirement: local.evidence_requirement,
        evidence_reference: local.evidence_reference,
        evidence_status: local.evidence_status,
      });
      onUpdate(updated);
      setEditing(false);
    } catch (e) {
      alert(e?.response?.data?.detail || "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setLocal(action);
    setEditing(false);
  }

  const isComplete = local.status === "complete";
  const hasEvidence = local.evidence_status === "provided";

  return (
    <div
      data-testid={`action-row-${action.id}`}
      className="py-6 border-b border-hairline"
    >
      {!editing ? (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-10">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`mono-num text-[9px] uppercase tracking-wider border px-2 py-0.5 ${STATUS_COLORS[local.status]}`}
              >
                {STATUS_LABELS[local.status]}
              </span>
              {hasEvidence && (
                <span className="mono-num text-[9px] uppercase tracking-wider border border-moss text-moss px-2 py-0.5">
                  Evidence Provided
                </span>
              )}
            </div>
            <div
              className={`font-body text-sm text-ink leading-snug mt-1 ${isComplete ? "line-through text-graphite" : ""}`}
            >
              {local.description}
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-graphite">
              {local.owner && (
                <span>
                  <span className="eyebrow text-[9px] mr-1">Owner</span>
                  {local.owner}
                </span>
              )}
              {local.target_date && (
                <span>
                  <span className="eyebrow text-[9px] mr-1">Due</span>
                  {local.target_date}
                </span>
              )}
              {local.evidence_requirement && (
                <span>
                  <span className="eyebrow text-[9px] mr-1">Requires</span>
                  {local.evidence_requirement}
                </span>
              )}
              {local.evidence_reference && (
                <span>
                  <span className="eyebrow text-[9px] mr-1">Ref</span>
                  <a
                    href={local.evidence_reference.startsWith("http") ? local.evidence_reference : undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink underline underline-offset-2"
                  >
                    {local.evidence_reference}
                  </a>
                </span>
              )}
            </div>
          </div>
          <div className="col-span-2 flex justify-end">
            <button
              onClick={() => setEditing(true)}
              className="eyebrow text-graphite hover:text-ink transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="eyebrow block mb-1">Description</label>
            <textarea
              rows={2}
              value={local.description}
              onChange={(e) => setLocal((p) => ({ ...p, description: e.target.value }))}
              className="w-full border border-hairline bg-bone p-2 text-sm text-ink focus:border-ink focus:outline-none resize-none"
              data-testid="action-description-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="eyebrow block mb-1">Owner</label>
              <input
                type="text"
                value={local.owner || ""}
                onChange={(e) => setLocal((p) => ({ ...p, owner: e.target.value }))}
                className="w-full border border-hairline bg-bone p-2 text-sm text-ink focus:border-ink focus:outline-none"
                data-testid="action-owner-input"
              />
            </div>
            <div>
              <label className="eyebrow block mb-1">Target Date</label>
              <input
                type="date"
                value={local.target_date || ""}
                onChange={(e) => setLocal((p) => ({ ...p, target_date: e.target.value }))}
                className="w-full border border-hairline bg-bone p-2 text-sm text-ink focus:border-ink focus:outline-none"
                data-testid="action-target-date-input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="eyebrow block mb-1">Status</label>
              <select
                value={local.status}
                onChange={(e) => setLocal((p) => ({ ...p, status: e.target.value }))}
                className="w-full border border-hairline bg-bone p-2 text-sm text-ink focus:border-ink focus:outline-none"
                data-testid="action-status-select"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="eyebrow block mb-1">Evidence Status</label>
              <select
                value={local.evidence_status}
                onChange={(e) => setLocal((p) => ({ ...p, evidence_status: e.target.value }))}
                className="w-full border border-hairline bg-bone p-2 text-sm text-ink focus:border-ink focus:outline-none"
                data-testid="action-evidence-status-select"
              >
                <option value="not_provided">Not Provided</option>
                <option value="provided">Provided</option>
              </select>
            </div>
          </div>
          <div>
            <label className="eyebrow block mb-1">Evidence Requirement</label>
            <input
              type="text"
              value={local.evidence_requirement || ""}
              onChange={(e) => setLocal((p) => ({ ...p, evidence_requirement: e.target.value }))}
              placeholder="What evidence is required?"
              className="w-full border border-hairline bg-bone p-2 text-sm text-ink focus:border-ink focus:outline-none"
              data-testid="action-evidence-requirement-input"
            />
          </div>
          <div>
            <label className="eyebrow block mb-1">Evidence Reference</label>
            <input
              type="text"
              value={local.evidence_reference || ""}
              onChange={(e) => setLocal((p) => ({ ...p, evidence_reference: e.target.value }))}
              placeholder="URL or document reference"
              className="w-full border border-hairline bg-bone p-2 text-sm text-ink focus:border-ink focus:outline-none"
              data-testid="action-evidence-reference-input"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              data-testid="action-save-btn"
              className="inline-flex items-center gap-2 bg-ink text-bone px-4 py-2 text-sm font-medium hover:bg-graphite transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save
            </button>
            <button
              onClick={cancel}
              className="inline-flex items-center gap-2 border border-hairline text-graphite px-4 py-2 text-sm hover:border-ink transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddActionForm({ planId, onAdd, onCancel }) {
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!description.trim()) return;
    setSaving(true);
    try {
      const action = await api.createAction(planId, {
        description,
        owner,
        target_date: targetDate || null,
        status: "not_started",
        evidence_requirement: "",
        evidence_reference: "",
        evidence_status: "not_provided",
      });
      onAdd(action);
      setDescription("");
      setOwner("");
      setTargetDate("");
    } catch (e) {
      alert(e?.response?.data?.detail || "Unable to add action.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="py-6 border-b border-hairline bg-sunken/40 px-4">
      <div className="eyebrow mb-3">New Action</div>
      <div className="space-y-3">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the remediation action"
          required
          className="w-full border border-hairline bg-bone p-2 text-sm text-ink focus:border-ink focus:outline-none"
          data-testid="new-action-description-input"
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Owner name"
            className="border border-hairline bg-bone p-2 text-sm text-ink focus:border-ink focus:outline-none"
            data-testid="new-action-owner-input"
          />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="border border-hairline bg-bone p-2 text-sm text-ink focus:border-ink focus:outline-none"
            data-testid="new-action-date-input"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !description.trim()}
            data-testid="add-action-submit-btn"
            className="inline-flex items-center gap-2 bg-ink text-bone px-4 py-2 text-sm font-medium hover:bg-graphite transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add Action
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="border border-hairline text-graphite px-4 py-2 text-sm hover:border-ink transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

export default function RemediationWorkspace() {
  const { initiativeId, planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [reassessing, setReassessing] = useState(false);

  const loadPlan = useCallback(async () => {
    try {
      const p = await api.getRemediationPlan(planId);
      setPlan(p);
    } catch (e) {
      setError(e?.response?.data?.detail || "Unable to load plan.");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  function handleActionUpdate(updated) {
    setPlan((prev) => ({
      ...prev,
      actions: prev.actions.map((a) => (a.id === updated.id ? updated : a)),
    }));
  }

  function handleActionAdd(action) {
    setPlan((prev) => ({ ...prev, actions: [...(prev.actions || []), action] }));
    setShowAddForm(false);
  }

  async function handleReassess() {
    setReassessing(true);
    try {
      const newAssessment = await api.createReassessment(initiativeId);
      navigate(`/assessment/${newAssessment.id}`);
    } catch (e) {
      alert(e?.response?.data?.detail || "Unable to start reassessment.");
    } finally {
      setReassessing(false);
    }
  }

  if (loading) {
    return (
      <div className="App">
        <TopNav />
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-24 flex items-center gap-3 text-graphite">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="eyebrow">Loading workspace…</span>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="App">
        <TopNav />
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-24">
          <div className="eyebrow text-oxblood">{error || "Plan not found."}</div>
        </div>
      </div>
    );
  }

  const finding = plan.source_finding || {};
  const isBlocker = finding.type === "blocker";
  const actions = plan.actions || [];
  const completedCount = actions.filter((a) => a.status === "complete").length;

  return (
    <div className="App">
      <TopNav
        crumb={
          <>
            <Link to={`/initiative/${initiativeId}`} className="hover:text-ink transition-colors">
              Initiative
            </Link>
            <span className="mx-1">·</span>
            <span className="text-ink">Remediation</span>
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
        data-testid="remediation-workspace"
        className="max-w-5xl mx-auto px-6 md:px-12 pt-12 pb-24 animate-fade-in"
      >
        {/* Source Finding */}
        <div
          className={`border-l-4 p-6 mb-12 ${
            isBlocker ? "border-oxblood bg-oxblood/[0.04]" : "border-ink bg-sunken/30"
          }`}
          data-testid="source-finding-panel"
        >
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`mono-num text-[10px] uppercase tracking-widest ${
                isBlocker ? "text-oxblood" : "text-graphite"
              }`}
            >
              {isBlocker ? "Operational Blocker" : "Operational Risk"} · Source Finding
            </span>
          </div>
          <div className="font-heading text-xl text-ink leading-snug">{finding.label}</div>
          <div className="mt-3 flex items-center gap-4">
            {finding.captured_score != null && (
              <span className="mono-num text-2xl text-ink">{finding.captured_score}</span>
            )}
            {finding.captured_band && (
              <span className="inline-flex items-center px-3 py-1 border border-ink mono-num text-[11px] uppercase tracking-[0.14em] bg-surface text-ink">
                {finding.captured_band}
              </span>
            )}
          </div>
        </div>

        {/* Plan Objective */}
        <section className="mb-12" data-testid="plan-objective-section">
          <div className="eyebrow mb-2">Remediation Objective</div>
          <blockquote className="font-heading text-2xl text-ink border-l border-ink pl-6 py-1 italic leading-snug">
            {plan.objective}
          </blockquote>
        </section>

        {/* Actions */}
        <section data-testid="actions-section">
          <div className="flex items-baseline justify-between border-b border-ink pb-4 mb-2">
            <h2 className="display-serif text-3xl">Remediation Actions</h2>
            <div className="eyebrow">
              {completedCount}/{actions.length} complete
            </div>
          </div>

          {actions.length === 0 && !showAddForm && (
            <div className="py-8 eyebrow text-slate2">No actions yet. Add one below.</div>
          )}

          {actions.map((action) => (
            <ActionRow key={action.id} action={action} onUpdate={handleActionUpdate} />
          ))}

          {showAddForm ? (
            <AddActionForm
              planId={planId}
              onAdd={handleActionAdd}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <div className="pt-6">
              <button
                onClick={() => setShowAddForm(true)}
                data-testid="add-action-btn"
                className="inline-flex items-center gap-2 border border-ink text-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-bone transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Action
              </button>
            </div>
          )}
        </section>

        {/* Reassess CTA */}
        <section className="mt-20 pt-10 border-t border-hairline">
          <div className="eyebrow mb-3">Readiness Reassessment</div>
          <p className="font-body text-sm text-graphite mb-6 max-w-xl leading-relaxed">
            When remediation activity is sufficiently progressed, initiate a full reassessment
            to produce a new deterministic readiness result. The original assessment remains preserved.
          </p>
          <button
            onClick={handleReassess}
            disabled={reassessing}
            data-testid="workspace-reassess-btn"
            className="inline-flex items-center gap-2 bg-ink text-bone px-6 py-3 font-body text-sm font-medium hover:bg-graphite transition-colors disabled:opacity-50"
          >
            {reassessing && <Loader2 className="w-4 h-4 animate-spin" />}
            Reassess Initiative
          </button>
        </section>
      </main>
    </div>
  );
}
