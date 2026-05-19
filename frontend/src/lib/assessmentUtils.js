/**
 * Pure helpers for computing assessment-workspace derived values.
 * Kept separate so they can be unit-tested without React.
 */

export function countTotalIndicators(dimensions) {
  return dimensions.reduce(
    (acc, d) => acc + d.sub_dimensions.reduce((a, s) => a + s.indicators.length, 0),
    0
  );
}

export function countAnsweredIndicators(evidence = {}) {
  return Object.values(evidence).filter((v) => v && v !== "not_started").length;
}

export function completionPercent(answered, total) {
  return total ? Math.round((answered / total) * 100) : 0;
}

export const MIN_COMPLETION_TO_GENERATE = 70;
