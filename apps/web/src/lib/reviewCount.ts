// Below this many reviews, the exact count (and an X.X/5 average computed
// from that few data points) risks reading as precise enough to reverse-
// identify a specific reviewer at a small company — the same anonymity
// concern CLAUDE.md's PII-vault design is built around. Below the threshold
// we show the score as a rounded percentage instead of hiding it outright.
export const MIN_REVIEWS_FOR_EXACT_COUNT = 4;

export function scoreAsPercent(avg: number): number {
  return Math.round((avg / 5) * 100);
}
