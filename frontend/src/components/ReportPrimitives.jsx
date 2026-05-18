import React from "react";

/** Tier rank used to color-code recommendation pill */
const TIER_TONE = {
  "Production Candidate": "bg-moss text-bone",
  "Proceed to Constrained Pilot": "bg-ink text-bone",
  "Remediate Before Expansion": "bg-amber2 text-bone",
  "Discovery Only": "bg-graphite text-bone",
  "Not Ready": "bg-oxblood text-bone",
};

export function MaturityBandBadge({ band }) {
  return (
    <span
      data-testid="maturity-band-badge"
      className="inline-flex items-center px-3 py-1 border border-ink mono-num text-[11px] uppercase tracking-[0.14em] bg-surface text-ink"
    >
      {band}
    </span>
  );
}

export function ConfidenceChip({ confidence }) {
  const tone = {
    High: "border-moss text-moss",
    Moderate: "border-ink text-ink",
    Low: "border-amber2 text-amber2",
  }[confidence] || "border-ink text-ink";

  return (
    <span
      data-testid="confidence-chip"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border mono-num text-[10px] uppercase tracking-[0.16em] bg-bone ${tone}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {confidence} Confidence
    </span>
  );
}

export function RecommendationPill({ tier }) {
  const cls = TIER_TONE[tier] || "bg-ink text-bone";
  return (
    <span
      data-testid="recommendation-pill"
      className={`inline-flex items-center px-4 py-2 text-sm font-medium ${cls}`}
    >
      {tier}
    </span>
  );
}

export function DimensionBar({ name, weight, score, band }) {
  const fillColor = score >= 75 ? "bg-ink" : score >= 50 ? "bg-graphite" : "bg-oxblood";
  return (
    <div
      data-testid={`dimension-bar-${name.toLowerCase().replace(/\s+/g, "-")}`}
      className="grid grid-cols-12 items-center gap-4 py-4 border-b border-hairline print-section"
    >
      <div className="col-span-12 md:col-span-4">
        <div className="font-body text-sm font-medium text-ink">{name}</div>
        <div className="eyebrow mt-1">Weight {Math.round(weight * 100)}%</div>
      </div>
      <div className="col-span-9 md:col-span-6">
        <div className="h-2 bg-hairline relative">
          <div
            className={`h-full ${fillColor} animate-bar-grow`}
            style={{ width: `${score}%`, "--bar-w": `${score}%` }}
          />
        </div>
      </div>
      <div className="col-span-3 md:col-span-2 flex items-baseline justify-end gap-2">
        <span className="mono-num text-2xl text-ink leading-none">{score}</span>
        <span className="eyebrow">{band}</span>
      </div>
    </div>
  );
}

export function BlockerCallout({ blocker }) {
  return (
    <div
      data-testid={`blocker-callout-${blocker.id}`}
      className="border-l-4 border-oxblood bg-oxblood/[0.04] p-6 print-section"
    >
      <div className="flex items-center gap-3">
        <span className="mono-num text-[11px] uppercase tracking-[0.16em] text-oxblood">
          Blocker · {blocker.impact.replace(/_/g, " ")}
        </span>
      </div>
      <div className="font-heading text-xl text-ink mt-2 leading-snug">{blocker.label}</div>
      <p className="font-body text-sm text-graphite mt-2 leading-relaxed">{blocker.message}</p>
      <p className="font-body text-sm text-ink mt-3">
        <span className="eyebrow mr-2">Remediation</span>
        {blocker.remediation}
      </p>
    </div>
  );
}
