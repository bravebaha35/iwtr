// Single place the site's branding is rendered — swapping in a different
// mark later means changing this one component, not hunting through every
// page/modal that shows the app name. The mark is a flat beaver-face badge
// (industrious, "busy as a beaver" — fits a platform built on people's real
// work history) rather than a generic initials chip or emoji, and it's
// drawn as plain shapes rather than an emoji so it stays crisp at any size
// and doesn't shift with the visitor's OS emoji set. The eye/tooth-gap
// "cutouts" are filled with the badge's own background color, so this
// component always needs to be rendered on a solid `bg-brand-600` (or
// equivalent) surface — see the two usages below.
export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  return (
    <span className={`flex ${box} shrink-0 items-center justify-center rounded-lg bg-brand-600`}>
      <svg viewBox="0 0 24 24" className="h-[70%] w-[70%]" aria-hidden="true">
        <circle cx="7" cy="6.5" r="2.3" fill="white" />
        <circle cx="17" cy="6.5" r="2.3" fill="white" />
        <circle cx="12" cy="12.5" r="7.5" fill="white" />
        <circle cx="9" cy="11.5" r="1" fill="var(--color-brand-600)" />
        <circle cx="15" cy="11.5" r="1" fill="var(--color-brand-600)" />
        <rect x="9.8" y="16.5" width="4.4" height="3.2" rx="0.8" fill="white" />
        <rect x="11.7" y="16.5" width="0.6" height="3.2" fill="var(--color-brand-600)" />
      </svg>
    </span>
  );
}
