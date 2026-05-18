import React from "react";

/**
 * 5-segment stepped maturity selector.
 * Visual progression: clicking a level fills that segment + all preceding.
 */
const ORDER = ["not_started", "informal", "drafted", "approved", "operationalized"];

export default function MaturitySelector({ value, onChange, indicatorId, scale }) {
  const currentIdx = ORDER.indexOf(value || "not_started");

  return (
    <div
      className="w-full grid grid-cols-5 gap-[2px] items-stretch h-14"
      role="radiogroup"
      data-testid={`maturity-selector-${indicatorId}`}
    >
      {ORDER.map((key, idx) => {
        const meta = scale[key];
        const isFilled = idx <= currentIdx;
        const isSelected = idx === currentIdx;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={isSelected}
            key={key}
            data-testid={`maturity-segment-${indicatorId}-${key}`}
            onClick={() => onChange(key)}
            className={[
              "border flex flex-col justify-center px-3 transition-colors duration-150 text-left",
              isFilled
                ? "bg-ink border-ink text-bone"
                : "bg-surface border-hairline text-graphite hover:bg-sunken hover:border-graphite/40",
              isSelected ? "ring-1 ring-offset-2 ring-offset-bone ring-ink" : "",
            ].join(" ")}
          >
            <span className="mono-num text-[10px] uppercase tracking-[0.14em] opacity-80">
              {String(meta.score)}
            </span>
            <span className="mt-1 text-[11px] md:text-xs font-medium leading-tight">
              {meta.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
