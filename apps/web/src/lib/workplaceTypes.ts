import { workplaceTypeSchema, type WorkplaceType } from "@iwtr/shared-types";

// Display labels are a presentation concern, kept here (not in shared-types)
// so relabeling is a one-file change — same principle as scoreBandColors.ts
// and avatars.ts. The set of values itself (workplaceTypeSchema.options)
// stays the single source of truth in shared-types.
const WORKPLACE_TYPE_LABELS: Record<WorkplaceType, string> = {
  OFFICE: "Office",
  HYBRID_REMOTE: "Hybrid/Remote",
  SERVICE: "Service",
  MANUAL_LABOUR: "Manual-Labour",
};

export const WORKPLACE_TYPES: { value: WorkplaceType; label: string }[] = workplaceTypeSchema.options.map(
  (value) => ({ value, label: WORKPLACE_TYPE_LABELS[value] }),
);

export function workplaceTypeLabel(value: WorkplaceType): string {
  return WORKPLACE_TYPE_LABELS[value];
}
