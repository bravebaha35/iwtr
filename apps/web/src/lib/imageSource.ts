/**
 * True for our own /public assets (default banners, mascot art), which
 * next/image resizes and re-encodes as WebP. Owner/user uploads come from
 * the API's /uploads as absolute URLs and are already stored as WebP, so
 * they're passed through unoptimized rather than proxied a second time.
 */
export function isOwnStaticAsset(src: string): boolean {
  return src.startsWith("/") && !src.startsWith("//");
}
