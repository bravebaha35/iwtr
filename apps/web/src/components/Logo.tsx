import Image from "next/image";

// Single place the site's branding is rendered — swapping in a different
// mark later means changing just this file's src (the one branding asset),
// not hunting through every page/modal that shows the app name. next/image
// serves a small WebP instead of the 3300px source PNG.
export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  return (
    <Image
      src="/realicon.png"
      alt="I Worked There"
      width={64}
      height={58}
      sizes="32px"
      priority
      className={`${box} shrink-0 rounded-lg object-contain`}
    />
  );
}
