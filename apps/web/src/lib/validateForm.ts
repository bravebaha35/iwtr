import type { ZodTypeAny } from "zod";

// Prefix zod's own default messages get (via the contextual errorMap below)
// so they can be told apart from a schema's hand-written message.
const DEFAULT_MARK = "\u0000default:";

function humanize(field: string): string {
  return field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

/**
 * Client-side check of a form against the same shared zod schema the API
 * enforces, so a mistake is explained before anything is sent. Returns a
 * short sentence about the first problem, or null when the form is valid.
 * A schema's own custom message wins; otherwise the field is named in
 * plain words (optionally via `labels`).
 */
export function formProblem(schema: ZodTypeAny, data: unknown, labels: Record<string, string> = {}): string | null {
  const result = schema.safeParse(data, { errorMap: (_issue, ctx) => ({ message: DEFAULT_MARK + ctx.defaultError }) });
  if (result.success) return null;
  const issue = result.error.issues[0];
  if (!issue.message.startsWith(DEFAULT_MARK)) {
    return issue.message.endsWith(".") ? issue.message : `${issue.message}.`;
  }
  const field = String(issue.path[issue.path.length - 1] ?? "");
  const label = labels[field] ?? (field ? humanize(field) : "form");
  return `Please check your ${label}.`;
}
