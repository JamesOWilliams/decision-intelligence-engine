import React from "react";
import { Loader2 } from "lucide-react";

/** Right rail — live deterministic preview of the score + active blockers + tier. */
export default function ReadinessPulse({ scoreSnapshot, scoring }) {
  return (
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
  );
}
