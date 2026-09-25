/**
 * Spam-trap headers for the anonymous review form. The proxy
 * (src/proxy.ts) rejects a submission whose hidden field was filled in or
 * that was sent faster than a person could answer it, before anything
 * reaches the API — and then strips both headers. They carry nothing about
 * the reviewer: an empty string for real people, and a duration.
 */
export function formTrapHeaders(opts: { openedAt: number; trapValue: string; now?: number }): Record<string, string> {
  const age = Math.max(0, (opts.now ?? Date.now()) - opts.openedAt);
  return { "x-form-trap": opts.trapValue, "x-form-age-ms": String(age) };
}
