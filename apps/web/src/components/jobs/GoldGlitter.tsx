// Small gold sparkles twinkling along the edges of a boosted job card
// (see .boosted-card / .gold-sparkle in globals.css). Purely decorative:
// hidden from screen readers and never catches a click.

// Where each sparkle sits, as a percentage of the card's width/height, plus
// its size in px and when it starts twinkling - staggered so they never all
// flash at once.
const SPARKLES: { left: number; top: number; size: number; delay: number }[] = [
  { left: 8, top: 0, size: 12, delay: 0 },
  { left: 38, top: 0, size: 8, delay: 1.1 },
  { left: 72, top: 0, size: 11, delay: 0.5 },
  { left: 100, top: 18, size: 9, delay: 1.7 },
  { left: 100, top: 62, size: 12, delay: 0.3 },
  { left: 86, top: 100, size: 9, delay: 1.4 },
  { left: 50, top: 100, size: 12, delay: 0.8 },
  { left: 16, top: 100, size: 8, delay: 2 },
  { left: 0, top: 74, size: 11, delay: 1.2 },
  { left: 0, top: 30, size: 9, delay: 0.2 },
];

export function GoldGlitter() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      {SPARKLES.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={s.size}
          height={s.size}
          className="gold-sparkle"
          style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s` }}
        >
          <path fill="currentColor" d="M12 0c.6 5.6 2.4 7.4 12 12-9.6 4.6-11.4 6.4-12 12-.6-5.6-2.4-7.4-12-12 9.6-4.6 11.4-6.4 12-12Z" />
        </svg>
      ))}
    </span>
  );
}
