import { scoreBandLabel } from "@iwtr/shared-types";

// Keyed off the label text (not re-derived thresholds) so this stays correct
// automatically if scoreBands' cutoffs ever change — only needs updating if a
// band's label text itself changes (see packages/shared-types/schemas/company.ts).
const SCORE_BAND_COLORS: Record<string, string> = {
  Unsatisfactory: "bg-red-500",
  Developing: "bg-orange-500",
  Effective: "bg-amber-500",
  Superb: "bg-lime-500",
  Exemplary: "bg-green-600",
};

const SCORE_BAND_TEXT_COLORS: Record<string, string> = {
  Unsatisfactory: "text-red-700 dark:text-red-400",
  Developing: "text-orange-700 dark:text-orange-400",
  Effective: "text-amber-700 dark:text-amber-400",
  Superb: "text-lime-700 dark:text-lime-400",
  Exemplary: "text-green-700 dark:text-green-400",
};

export function scoreBarColor(avg: number): string {
  return SCORE_BAND_COLORS[scoreBandLabel(avg)] ?? "bg-foreground";
}

export function scoreTextColor(avg: number): string {
  return SCORE_BAND_TEXT_COLORS[scoreBandLabel(avg)] ?? "text-muted-foreground";
}
