// Placeholder for a Google Ad Manager banner. Swap the contents of this one
// component for the real ad tag/script once an ad account is set up — every
// call site (currently the homepage's left/right rails) picks it up
// automatically. Hidden below `xl` since there's no spare width for it on
// smaller screens.
export function AdSlot() {
  return (
    <div
      className="hidden w-40 shrink-0 items-center justify-center self-start rounded-lg border border-dashed border-border text-xs text-muted-foreground xl:flex"
      style={{ minHeight: 600 }}
    >
      Ad space
    </div>
  );
}
