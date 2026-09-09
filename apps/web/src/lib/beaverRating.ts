// Custom mood art for the 0/2.5/5 rating scale (apps/web/public). Shared
// between the Home rating-filter slider (WorkplaceBrowser) and the IWT
// Social company hero card (BeaverRatingIcon) — one definition so the two
// can't drift.
export const RATING_TICKS: { value: number; src: string; alt: string }[] = [
  { value: 0, src: "/1LowMood.png", alt: "Low rating" },
  { value: 2.5, src: "/3MidMood.png", alt: "Mid rating" },
  { value: 5, src: "/5HighMood.png", alt: "High rating" },
];

// Which of the 3 mood mascots is "live" for a 0-5 value — an even 3-way
// split of the range (not tied to the ticks' anchor values).
export function activeMoodIndex(value: number): 0 | 1 | 2 {
  if (value < 5 / 3) return 0;
  if (value < 10 / 3) return 1;
  return 2;
}
