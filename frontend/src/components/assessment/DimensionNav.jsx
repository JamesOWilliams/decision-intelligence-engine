import React from "react";
import { Loader2 } from "lucide-react";

/** Left rail — vertical (desktop) or 2-col grid (mobile) of dimension nav tiles. */
export default function DimensionNav({
  dimensions,
  activeIdx,
  onSelect,
  dimensionScores = [],
  completePct,
  answeredCount,
  totalCount,
}) {
  return (
    <aside className="col-span-12 md:col-span-3 md:border-r md:border-hairline md:pr-6">
      <div className="eyebrow mb-4">Readiness Dimensions</div>
      <nav className="grid grid-cols-2 gap-1 md:flex md:flex-col" data-testid="dimension-nav">
        {dimensions.map((d, idx) => {
          const active = idx === activeIdx;
          const dimScore = dimensionScores.find((x) => x.id === d.id)?.score ?? null;
          return (
            <button
              key={d.id}
              data-testid={`dimension-nav-${d.id}`}
              onClick={() => onSelect(idx)}
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
          <div
            className="h-full bg-ink transition-all duration-500"
            style={{ width: `${completePct}%` }}
          />
        </div>
        <div className="mt-2 mono-num text-xs text-graphite">
          {answeredCount} / {totalCount} indicators
        </div>
      </div>
    </aside>
  );
}

/* Re-export the spinner so callers needn't import from lucide separately */
export { Loader2 };
