import React from "react";

export default function InitiativeSummary({ description, expectedOutcomes }) {
  if (!description) return null;
  return (
    <section className="mt-16 print-section">
      <div className="eyebrow mb-3">Initiative Summary</div>
      <p className="font-body text-base text-ink leading-relaxed max-w-4xl">{description}</p>
      {expectedOutcomes && (
        <p className="font-body text-sm text-graphite leading-relaxed max-w-4xl mt-4">
          <span className="eyebrow mr-2">Expected Outcomes</span>
          {expectedOutcomes}
        </p>
      )}
    </section>
  );
}
