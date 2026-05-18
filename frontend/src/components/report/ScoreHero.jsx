import React from "react";
import { MaturityBandBadge, ConfidenceChip, RecommendationPill } from "@/components/ReportPrimitives";

/** Score numeral + badges + recommendation pill, with reasoning blockquote in right column. */
export default function ScoreHero({ scores, narrative }) {
  return (
    <section className="grid grid-cols-12 gap-8 mt-12 print-section">
      <div className="col-span-12 md:col-span-7">
        <div className="eyebrow">Organizational Readiness</div>
        <div className="flex items-baseline gap-3 mt-3">
          <span
            data-testid="score-hero-numeral"
            className="mono-num text-[7.5rem] md:text-[10rem] leading-none text-ink tracking-tighter print-hero-numeral"
          >
            {scores.domain_score}
          </span>
          <span className="mono-num text-2xl text-slate2">/ 100</span>
        </div>
        <div className="mt-6 flex items-center gap-3 flex-wrap">
          <MaturityBandBadge band={scores.maturity_band} />
          <ConfidenceChip confidence={scores.confidence} />
        </div>
        <div className="mt-6">
          <div className="eyebrow mb-2">Recommendation</div>
          <RecommendationPill tier={scores.recommendation_tier} />
          {scores.tier_downgraded && (
            <div className="mt-2 text-xs text-oxblood">
              Tier downgraded from{" "}
              <span className="font-medium">{scores.raw_tier_before_blockers}</span> due to active blockers.
            </div>
          )}
        </div>
      </div>

      <div className="col-span-12 md:col-span-5">
        <div className="eyebrow mb-3">Executive Reasoning</div>
        <blockquote
          data-testid="reasoning-narrative"
          className="font-heading text-xl md:text-2xl leading-relaxed text-ink border-l border-ink pl-6 py-1 italic"
        >
          {narrative}
        </blockquote>
      </div>
    </section>
  );
}
