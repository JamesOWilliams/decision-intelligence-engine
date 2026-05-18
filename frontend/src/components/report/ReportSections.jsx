import React from "react";
import { DimensionBar, BlockerCallout } from "@/components/ReportPrimitives";

export function DimensionBreakdownSection({ dimensions }) {
  return (
    <section className="mt-20 print-section">
      <div className="flex items-baseline justify-between border-b border-ink pb-4 mb-6">
        <h2 className="display-serif text-3xl">Dimension Breakdown</h2>
        <div className="eyebrow">5 dimensions · weighted</div>
      </div>
      <div>
        {dimensions.map((d) => (
          <DimensionBar key={d.id} name={d.name} weight={d.weight} score={d.score} band={d.band} />
        ))}
      </div>
    </section>
  );
}

export function BlockersSection({ blockers }) {
  if (!blockers?.length) return null;
  return (
    <section className="mt-20 print-section">
      <div className="flex items-baseline justify-between border-b border-oxblood pb-4 mb-6">
        <h2 className="display-serif text-3xl text-oxblood">Operational Blockers</h2>
        <div className="eyebrow text-oxblood">
          {blockers.length} active · downgrades recommendation
        </div>
      </div>
      <div className="space-y-4">
        {blockers.map((b) => (
          <BlockerCallout key={b.id} blocker={b} />
        ))}
      </div>
    </section>
  );
}

/** Two-column structured list of LLM-derived strengths and risks. */
export function StrengthsRisksSection({ strengths = [], risks = [], testIds = {} }) {
  return (
    <section className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-12 print-section">
      <ItemList
        title="Organizational Strengths"
        items={strengths}
        numberTone="text-slate2"
        testId={testIds.strengths}
        prefix="s"
      />
      <ItemList
        title="Operational Risks"
        items={risks}
        numberTone="text-oxblood"
        testId={testIds.risks}
        prefix="r"
      />
    </section>
  );
}

function ItemList({ title, items, numberTone, testId, prefix }) {
  return (
    <div>
      <div className="border-b border-ink pb-4 mb-6">
        <h2 className="display-serif text-3xl">{title}</h2>
      </div>
      <ul {...(testId ? { "data-testid": testId } : {})} className="space-y-4">
        {items.map((text, i) => (
          <li
            key={`${prefix}-${i}-${(text || "").slice(0, 40)}`}
            className="flex gap-4"
          >
            <span className={`mono-num text-xs ${numberTone} mt-1.5`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-ink leading-relaxed text-[15px]">{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RemediationSection({ actions = [], testId }) {
  return (
    <section className="mt-20 print-section">
      <div className="flex items-baseline justify-between border-b border-ink pb-4 mb-8">
        <h2 className="display-serif text-3xl">Prioritized Remediation Actions</h2>
        <div className="eyebrow">Sequenced by impact</div>
      </div>
      <ol {...(testId ? { "data-testid": testId } : {})} className="space-y-8">
        {actions.map((a, i) => (
          <li
            key={`a-${a.priority ?? i}-${(a.action || "").slice(0, 40)}`}
            className="grid grid-cols-12 gap-6"
          >
            <div className="col-span-2 md:col-span-1">
              <span className="mono-num text-3xl text-ink">{a.priority || i + 1}</span>
            </div>
            <div className="col-span-10 md:col-span-11">
              <div className="font-heading text-xl text-ink leading-snug">{a.action}</div>
              <div className="text-sm text-graphite mt-2 leading-relaxed">{a.rationale}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
