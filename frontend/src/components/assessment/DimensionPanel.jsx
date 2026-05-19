import React from "react";
import { ArrowUpRight, HelpCircle, Loader2 } from "lucide-react";
import MaturitySelector from "@/components/MaturitySelector";

/** Center pane — single dimension with its sub-dimensions + indicators + nav footer. */
export default function DimensionPanel({
  dimension,
  index,
  total,
  evidence = {},
  scale,
  onIndicatorChange,
  onPrev,
  onNext,
  onGenerate,
  canGenerate,
  completePct,
  generating,
}) {
  if (!dimension) return null;

  const isLast = index === total - 1;

  return (
    <section className="col-span-12 md:col-span-6 animate-fade-in" key={dimension.id}>
      <div className="eyebrow">
        {`Dimension ${String(index + 1).padStart(2, "0")} · Weight ${Math.round(dimension.weight * 100)}%`}
      </div>
      <h1 className="display-serif text-4xl md:text-5xl mt-3">{dimension.name}</h1>
      <p className="font-body text-base text-graphite leading-relaxed mt-5 max-w-3xl">
        {dimension.operational_definition}
      </p>

      <div className="mt-12 space-y-10">
        {dimension.sub_dimensions.map((sub) => (
          <SubDimensionCard
            key={sub.id}
            sub={sub}
            evidence={evidence}
            scale={scale}
            onIndicatorChange={onIndicatorChange}
          />
        ))}
      </div>

      {/* Dimension nav footer */}
      <div className="mt-12 pt-8 border-t border-hairline flex items-center justify-between">
        <button
          data-testid="prev-dim-btn"
          onClick={onPrev}
          disabled={index === 0}
          className="eyebrow disabled:opacity-30 hover:text-ink transition-colors"
        >
          ← Previous dimension
        </button>
        {!isLast ? (
          <button
            data-testid="next-dim-btn"
            onClick={onNext}
            className="group inline-flex items-center gap-2 text-ink border border-ink px-5 py-2.5 text-sm font-medium hover:bg-ink hover:text-bone transition-colors"
          >
            Next dimension <ArrowUpRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            data-testid="generate-report-btn"
            onClick={onGenerate}
            disabled={!canGenerate || generating}
            className="group inline-flex items-center gap-3 bg-ink text-bone px-6 py-3.5 font-medium text-[15px] hover:bg-graphite transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Generating briefing…
              </>
            ) : (
              <>
                Generate Executive Briefing
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </>
            )}
          </button>
        )}
      </div>
      {!canGenerate && isLast && (
        <p className="mt-3 text-xs text-graphite text-right">
          Generate available at 70%+ completion. Currently {completePct}%.
        </p>
      )}
    </section>
  );
}

function SubDimensionCard({ sub, evidence, scale, onIndicatorChange }) {
  return (
    <div className="border border-hairline bg-surface p-8" data-testid={`sub-dim-${sub.id}`}>
      <div className="flex items-baseline justify-between border-b border-hairline pb-4">
        <h3 className="font-heading text-2xl text-ink">{sub.name}</h3>
        <span className="eyebrow">
          {sub.indicators.length} indicator{sub.indicators.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="mt-6 space-y-8">
        {sub.indicators.map((ind) => (
          <IndicatorRow
            key={ind.id}
            indicator={ind}
            value={evidence[ind.id] || "not_started"}
            scale={scale}
            onChange={onIndicatorChange}
          />
        ))}
      </div>
    </div>
  );
}

function IndicatorRow({ indicator, value, scale, onChange }) {
  return (
    <div>
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1">
          <div className="font-body text-sm font-medium text-ink leading-snug">
            {indicator.label}
          </div>
          <div className="text-xs text-graphite mt-1 flex items-start gap-1.5 leading-relaxed">
            <HelpCircle className="w-3 h-3 mt-0.5 text-slate2 shrink-0" strokeWidth={1.5} />
            <span>{indicator.help_text}</span>
          </div>
        </div>
      </div>
      <MaturitySelector
        value={value}
        onChange={(v) => onChange(indicator.id, v)}
        indicatorId={indicator.id}
        scale={scale}
      />
    </div>
  );
}
