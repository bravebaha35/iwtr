// Single place the site's branding is rendered. Right now it's a colored
// initials badge (color comes from the --color-brand-* tokens in
// globals.css) — swapping in a real logo image later means changing this
// one component (e.g. an <Image src="/logo.svg" /> instead of the span),
// not hunting through every page/modal that shows the app name.
export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm";
  return (
    <span className={`flex ${box} items-center justify-center rounded-lg bg-brand-600 font-bold text-white`}>
      IWT
    </span>
  );
}
