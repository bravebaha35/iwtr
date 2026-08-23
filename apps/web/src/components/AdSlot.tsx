// Placeholder for a Google Ad Manager banner. Swap the contents of this one
// component for the real ad tag/script once an ad account is set up — every
// call site picks it up automatically.
export function AdSlot({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  // "vertical": narrow tall rail, hidden below `xl` since there's no spare
  // width for it on smaller screens — used for the homepage's left/right
  // rails. "horizontal": full-width short banner, shown at every breakpoint
  // — used above/below the hero, where a tall rail shape doesn't fit.
  if (orientation === "horizontal") {
    return (
      <div
        className="flex w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground"
        style={{ minHeight: 90 }}
      >
        Ad space
      </div>
    );
  }
  return (
    <div
      className="hidden w-40 shrink-0 items-center justify-center self-start rounded-lg border border-dashed border-border text-xs text-muted-foreground xl:flex"
      style={{ minHeight: 600 }}
    >
      Ad space
    </div>
  );
}
