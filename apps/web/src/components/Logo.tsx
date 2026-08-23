// Single place the site's branding is rendered — swapping in a different
// mark later means changing just /public/logo.svg (the one branding asset),
// not hunting through every page/modal that shows the app name.
export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  // eslint-disable-next-line @next/next/no-img-element -- static brand mark, not a Next/Image candidate
  return <img src="/logo.svg" alt="I Worked There" className={`${box} shrink-0 rounded-lg object-contain`} />;
}
