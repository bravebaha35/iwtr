import Image from "next/image";

// Single place the site's branding is rendered — swapping in a different
// mark later means changing just this file's src (the one branding asset),
// not hunting through every page/modal that shows the app name. next/image
// serves a small WebP of the 256px brand mark.
export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  return (
    <Image
      src="/brand-mark.png"
      alt="I Worked There"
      width={64}
      height={64}
      sizes="32px"
      priority
      className={`${box} shrink-0 rounded-[0.5rem] object-contain`}
    />
  );
}
