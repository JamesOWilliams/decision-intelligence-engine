import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Plus, BarChart2, Loader2, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import TopNav from "@/components/TopNav";
import { MaturityBandBadge, RecommendationPill } from "@/components/ReportPrimitives";
import DecisionRecordDialog from "@/components/DecisionRecordDialog";
import { api } from "@/lib/api";

function StatusDot({ status }) {
  const colors = {
    not_started: "bg-slate2",
    in_progress: "bg-amber2",
    complete: "bg-moss",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status] || "bg-slate2"} mr-2`}
      aria-hidden
    />
  );
}

function AssessmentRow({ assessment, index, onSelect, selected }) {
  const snap = assessment.score_snapshot;
  const date = assessment.completed_at || assessment.created_at;
  const displayDate = date
    ? new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <div
      data-testid={`assessment-row-${index}`}
      className={`grid grid-cols-12 gap-4 items-center py-5 border-b border-hairline cursor-pointer transition-colors ${
        selected ? "bg-sunken" : "hover:bg-sunken/50"
      }`}
      onClick={() => onSelect(assessment.id)}
    >
      {/* Selector */}
      <div className="col-span-1 flex justify-center">
        <div
          className={`w-4 h-4 border ${
            selected ? "border-ink bg-ink" : "border-slate2"
          }`}
          aria-label={selected ? "Selected" : "Select for comparison"}
        >
          {selected && (
            <svg viewBox="0 0 16 16" fill="none" className="w-full h-full p-0.5">
              <path d="M3 8l3.5 3.5L13 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>

      {/* Assessment number + date */}
      <div className="col-span-2">
        <div className="mono-num text-xs text-graphite">#{String(index + 1).padStart(2, "0")}</div>
        <div className="eyebrow mt-1">{displayDate}</div>
      </div>

      {/* Score */}
      <div className="col-span-2">
        {snap ? (
          <span className="mono-num text-3xl text-ink">{snap.domain_score}</span>
        ) : (
          <span className="eyebrow text-slate2">No score</span>
        )}
      </div>

      {/* Band + Recommendation */}
      <div className="col-span-4 flex flex-col gap-2">
        {snap && <MaturityBandBadge band={snap.maturity_band} />}
        {snap && <RecommendationPill tier={snap.recommendation_tier} />}
        {!snap && assessment.status === "draft" && (
          <span className="eyebrow text-slate2">In progress</span>
        )}
      </div>

      {/* Actions */}
      <div className="col-span-3 flex justify-end gap-2">
        {assessment.status === "completed" && (
          <Link
            to={`/report/${assessment.id}`}
            onClick={(e) => e.stopPropagation()}
            data-testid={`view-report-btn-${index}`}
            className="eyebrow text-ink border border-ink px-3 py-1.5 hover:bg-ink hover:text-bone transition-colors"
          >
            View Report
          </Link>
        )}
        {assessment.status !== "completed" && (
          <Link
            to={`/assessment/${assessment.id}`}
            onClick={(e) => e.stopPropagation()}
            className="eyebrow text-graphite border border-hairline px-3 py-1.5 hover:border-ink transition-colors"
          >
            Continue
          </Link>
        )}
      </div>
    </div>
  );
}

function PlanRow({ plan }) {
  const actions = plan.actions || [];
  const complete = actions.filter((a) => a.status === "complete").length;
  const inProgress = actions.filter((a) => a.status === "in_progress").length;
  const notStarted = actions.filter((a) => a.status === "not_started").length;
  const findingType = plan.source_finding?.type;

  return (
    <div
      data-testid={`plan-row-${plan.id}`}
      className="py-5 border-b border-hairline"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 mono-num text-[9px] uppercase tracking-wider ${
                findingType === "blocker"
                  ? "bg-oxblood/10 text-oxblood border border-oxblood/30"
                  : "bg-graphite/10 text-graphite border border-hairline"
              }`}
            >
              {findingType}
            </span>
            <span className="eyebrow text-graphite">{plan.source_finding?.label}</span>
          </div>
          <div className="font-body text-sm text-ink leading-snug">{plan.objective}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="mono-num text-xs text-graphite">{actions.length} action{actions.length !== 1 ? "s" : ""}</div>
            <div className="eyebrow text-[9px] mt-0.5">
              {complete}c · {inProgress}ip · {notStarted}ns
            </div>
          </div>
          <Link
            to={`/initiative/${plan.initiative_id}/remediation/${plan.id}`}
            data-testid={`open-plan-btn-${plan.id}`}
            className="eyebrow text-ink border border-ink px-3 py-1.5 hover:bg-ink hover:text-bone transition-colors"
          >
            Open
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function InitiativeOverview() {
  const { initiativeId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [reassessing, setReassessing] = useState(false);

  // Decision Record state
  const [drData, setDrData] = useState(null);
  const [drDialogOpen, setDrDialogOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getInitiative(initiativeId)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e?.response?.data?.detail || "Unable to load initiative."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [initiativeId]);

  useEffect(() => {
    let alive = true;
    api.getDecisionRecords(initiativeId)
      .then((d) => { if (alive) setDrData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [initiativeId]);

  function toggleSelect(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.slice(-1), id]
    );
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

  function handleCompare() {
    const [a, b] = selected;
    navigate(`/initiative/${initiativeId}/comparison?from=${a}&to=${b}`);
  }

  if (loading) {
    return (
      <div className="App">
        <TopNav />
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-24 flex items-center gap-3 text-graphite">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="eyebrow">Loading initiative…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="App">
        <TopNav />
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-24">
          <div className="eyebrow text-oxblood">{error || "Initiative not found."}</div>
        </div>
      </div>
    );
  }

  const { initiative, assessments, remediation_plans } = data;
  const completed = assessments.filter((a) => a.status === "completed");
  const canCompare = selected.length === 2;

  return (
    <div className="App">
      <TopNav
        crumb={
          <>
            <span>Initiative</span> · <span className="text-ink">{initiative.name || "Unnamed"}</span>
          </>
        }
        right={
          <button
            onClick={() => navigate(-1)}
            className="eyebrow hover:text-ink transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3 h-3" />
            <span className="hidden sm:inline">Back</span>
          </button>
        }
      />

      <main
        data-testid="initiative-overview"
        className="max-w-5xl mx-auto px-6 md:px-12 pt-12 pb-24 animate-fade-in"
      >
        {/* Initiative header */}
        <header className="pb-10 border-b border-ink">
          <div className="eyebrow mb-2">Initiative Overview</div>
          <h1 className="display-serif text-4xl sm:text-5xl mt-2 leading-tight">
            {initiative.name || "Unnamed Initiative"}
          </h1>
          <div className="mt-4 flex flex-wrap gap-3 items-center">
            {initiative.business_unit && (
              <span className="eyebrow">{initiative.business_unit}</span>
            )}
            {initiative.stage && (
              <span className="eyebrow border border-hairline px-2 py-0.5 uppercase">
                {initiative.stage.replace("_", " ")}
              </span>
            )}
          </div>
          {initiative.description && (
            <p className="font-body text-sm text-graphite mt-4 max-w-2xl leading-relaxed">
              {initiative.description}
            </p>
          )}
        </header>

        {/* Assessment History */}
        <section className="mt-16" data-testid="assessment-history">
          <div className="flex items-baseline justify-between border-b border-ink pb-4 mb-2">
            <h2 className="display-serif text-3xl">Assessment History</h2>
            <div className="eyebrow">{assessments.length} assessment{assessments.length !== 1 ? "s" : ""}</div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-4 py-2 border-b border-hairline">
            <div className="col-span-1" />
            <div className="col-span-2 eyebrow">#  ·  Date</div>
            <div className="col-span-2 eyebrow">Score</div>
            <div className="col-span-4 eyebrow">Maturity · Recommendation</div>
            <div className="col-span-3 eyebrow text-right">Actions</div>
          </div>

          {assessments.length === 0 ? (
            <div className="py-8 eyebrow text-slate2">No assessments yet.</div>
          ) : (
            [...assessments].reverse().map((a, i) => (
              <AssessmentRow
                key={a.id}
                assessment={a}
                index={assessments.length - 1 - i}
                onSelect={(id) => completed.find((c) => c.id === id) && toggleSelect(id)}
                selected={selected.includes(a.id)}
              />
            ))
          )}

          {/* Comparison notice */}
          {completed.length >= 2 && (
            <div className="mt-6 flex items-center gap-3">
              <div className="eyebrow text-graphite">
                {selected.length < 2
                  ? `Select 2 completed assessments to compare (${selected.length}/2 selected)`
                  : "2 assessments selected — ready to compare"}
              </div>
              {canCompare && (
                <button
                  onClick={handleCompare}
                  data-testid="compare-assessments-btn"
                  className="inline-flex items-center gap-2 border border-ink text-ink px-4 py-2 eyebrow hover:bg-ink hover:text-bone transition-colors"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  Compare
                </button>
              )}
            </div>
          )}
        </section>

        {/* CTAs */}
        <section className="mt-12 flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleReassess}
            disabled={reassessing}
            data-testid="reassess-initiative-btn"
            className="inline-flex items-center gap-2 bg-ink text-bone px-6 py-3 font-body text-sm font-medium hover:bg-graphite transition-colors disabled:opacity-50"
          >
            {reassessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Reassess Initiative
          </button>
          {completed.length > 0 && (
            <Link
              to={`/report/${completed[completed.length - 1].id}`}
              className="inline-flex items-center gap-2 border border-ink text-ink px-6 py-3 font-body text-sm font-medium hover:bg-ink hover:text-bone transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              View Latest Briefing
            </Link>
          )}
        </section>

        {/* Remediation Plans */}
        {remediation_plans && remediation_plans.length > 0 && (
          <section className="mt-20" data-testid="remediation-plans-section">
            <div className="flex items-baseline justify-between border-b border-ink pb-4 mb-2">
              <h2 className="display-serif text-3xl">Remediation Plans</h2>
              <div className="eyebrow">{remediation_plans.length} plan{remediation_plans.length !== 1 ? "s" : ""}</div>
            </div>
            {remediation_plans.map((plan) => (
              <PlanRow key={plan.id} plan={plan} />
            ))}
          </section>
        )}

        {/* Organizational Decision */}
        {completed.length > 0 && (
          <section className="mt-20" data-testid="decision-records-section">
            <div className="flex items-baseline justify-between border-b border-ink pb-4 mb-6">
              <h2 className="display-serif text-3xl">Organizational Decision</h2>
              <button
                onClick={() => setDrDialogOpen(true)}
                data-testid="record-decision-btn"
                className="inline-flex items-center gap-2 border border-ink text-ink px-3 py-1.5 eyebrow hover:bg-ink hover:text-bone transition-colors"
              >
                <FileText className="w-3 h-3" />
                Record Decision
              </button>
            </div>

            {/* Active decision */}
            {drData?.active ? (
              <div
                className="border border-ink p-6 mb-6"
                data-testid="active-decision-record"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="eyebrow text-graphite mb-1">Active Decision</div>
                    <div className="display-serif text-2xl text-ink">
                      {drData.active.human_decision}
                    </div>
                    <div className="eyebrow mt-2 text-graphite">
                      {drData.active.decision_authority} · {drData.active.decision_date}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {drData.active.variance?.variance_exists === false ? (
                      <div
                        className="inline-flex items-center gap-1.5 border border-moss/40 bg-moss/5 text-moss px-3 py-1.5 eyebrow text-[10px]"
                        data-testid="variance-aligned"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Aligned with system
                      </div>
                    ) : drData.active.variance?.variance_exists === true ? (
                      <div
                        className="inline-flex items-center gap-1.5 border border-amber2/40 bg-amber2/5 text-amber2 px-3 py-1.5 eyebrow text-[10px]"
                        data-testid="variance-diverges"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Diverges from system
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* System position */}
                <div className="mt-4 pt-4 border-t border-hairline grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="eyebrow text-[9px] mb-1">System Recommendation</div>
                    <div className="font-body text-xs text-ink">
                      {drData.active.system_position_snapshot?.recommendation_tier}
                    </div>
                  </div>
                  <div>
                    <div className="eyebrow text-[9px] mb-1">Score at Decision</div>
                    <span className="mono-num text-2xl text-graphite">
                      {drData.active.system_position_snapshot?.domain_score}
                    </span>
                  </div>
                  <div>
                    <div className="eyebrow text-[9px] mb-1">Maturity Band</div>
                    <div className="font-body text-xs text-ink">
                      {drData.active.system_position_snapshot?.maturity_band}
                    </div>
                  </div>
                  {drData.active.rationale && (
                    <div className="col-span-2 md:col-span-1">
                      <div className="eyebrow text-[9px] mb-1">Rationale</div>
                      <p className="font-body text-xs text-graphite leading-snug">
                        {drData.active.rationale}
                      </p>
                    </div>
                  )}
                  {drData.active.conditions && drData.active.human_decision === "Proceed with Conditions" && (
                    <div className="col-span-2 md:col-span-4">
                      <div className="eyebrow text-[9px] mb-1">Conditions</div>
                      <p className="font-body text-xs text-graphite leading-snug">
                        {drData.active.conditions}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-6 eyebrow text-slate2" data-testid="no-decision-yet">
                No decision recorded yet. Record a decision against a completed assessment.
              </div>
            )}

            {/* Superseded history */}
            {drData?.history?.length > 0 && (
              <div data-testid="superseded-decisions">
                <div className="eyebrow mb-3 text-graphite">
                  Prior Decisions ({drData.history.length})
                </div>
                {drData.history.map((sr) => (
                  <div
                    key={sr.id}
                    className="py-4 border-b border-hairline grid grid-cols-12 gap-4 items-center"
                    data-testid={`superseded-record-${sr.id}`}
                  >
                    <div className="col-span-8 md:col-span-5">
                      <div className="font-body text-sm text-graphite line-through">
                        {sr.human_decision}
                      </div>
                      <div className="eyebrow mt-1 text-[9px]">
                        {sr.decision_authority} · {sr.decision_date}
                      </div>
                    </div>
                    <div className="col-span-4 md:col-span-3">
                      <span className="mono-num text-xs text-slate2">
                        {sr.system_position_snapshot?.domain_score} ·{" "}
                        {sr.system_position_snapshot?.maturity_band}
                      </span>
                    </div>
                    <div className="hidden md:block col-span-4 text-right">
                      <span className="eyebrow text-[9px] text-slate2 border border-hairline px-2 py-0.5">
                        superseded
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Decision Record Dialog */}
      <DecisionRecordDialog
        open={drDialogOpen}
        onClose={() => setDrDialogOpen(false)}
        onCreated={(record) => {
          setDrData((prev) => {
            const history = prev?.active ? [prev.active, ...(prev?.history || [])] : (prev?.history || []);
            return { active: record, history, total: history.length + 1, initiative_id: initiativeId };
          });
        }}
        initiativeId={initiativeId}
        completedAssessments={completed}
      />
    </div>
  );
}
