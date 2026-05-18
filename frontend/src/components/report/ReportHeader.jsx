import React from "react";

/** Initiative metadata header — accepts customizable eyebrow strings (used by Report + Shared pages). */
export default function ReportHeader({
  initiative,
  generated_at,
  leadEyebrow,
  trailingEyebrow,
}) {
  const dateText = generated_at
    ? new Date(generated_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      })
    : null;

  return (
    <header className="pb-10 border-b border-ink">
      <div className="flex items-center justify-between">
        <div className="eyebrow">{leadEyebrow}</div>
        <div className="eyebrow">
          {dateText && (
            <span className="mono-num text-xs uppercase tracking-[0.14em]">{dateText}</span>
          )}
          {dateText && trailingEyebrow ? " · " : ""}
          {trailingEyebrow}
        </div>
      </div>
      <h1 className="display-serif text-4xl md:text-6xl mt-6">
        {initiative.name || "Untitled Initiative"}
      </h1>
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
        <Cell label="Business Unit" value={initiative.business_unit} />
        <Cell
          label="Initiative Stage"
          value={(initiative.stage || "").replace(/_/g, " ")}
          capitalize
        />
        <Cell label="Target Workflow" value={initiative.target_workflow} />
      </div>
    </header>
  );
}

function Cell({ label, value, capitalize }) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <div className={`text-ink ${capitalize ? "capitalize" : ""}`}>{value || "—"}</div>
    </div>
  );
}
