"use client";

/**
 * Shared "clear this filter section back to no filter" control — replaces
 * the old "All" text buttons on Workplace/Rating/Location, which used to
 * double as a toggle-select-every-option control. This is a pure reset:
 * there's no "select every option" state to toggle into anymore, just a
 * one-click rewind back to the section's default (which, since every filter
 * here is additive server-side, is the same thing as "show everything").
 */
export function RewindButton({
  onClick,
  active,
  title = "Reset",
}: {
  onClick: () => void;
  // Whether this section currently has anything to reset — dims the icon
  // (rather than disabling it outright) when it's already at its default,
  // so it doesn't read as a broken/dead control.
  active: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`transition ${active ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground/70"}`}
    >
      {/* Circular "restore" arrow, not the media fast-rewind glyph — a
          near-complete ring with a gap on the lower-left, closed off by a
          bold left-pointing arrowhead where the ring would otherwise
          continue. */}
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M3.31 14.33A9 9 0 1 1 9.67 20.69L10.58 17.31A5.5 5.5 0 1 0 6.69 13.42Z" />
        <polygon points="7,7 1,12.5 7,18" />
      </svg>
    </button>
  );
}
