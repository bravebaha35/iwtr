import type { WorkplaceType } from "@iwtr/shared-types";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";

// Employee-facing rendering of a company's work-types: the PRIMARY
// (workplaceTypes[0]) in a bold weight, the SECONDARY (workplaceTypes[1]),
// when present, in a normal weight after a slash. The "primary / secondary"
// terminology itself is owner-only (the company edit page) — everywhere an
// employee looks they just see the emphasis. Used on the job cards, the
// rating surfaces, and the IWT Social feed so all three read the same way.
export function WorkTypeLabel({
  workplaceTypes,
  className,
}: {
  workplaceTypes: WorkplaceType[];
  className?: string;
}) {
  const [primary, secondary] = workplaceTypes;
  return (
    <span className={className}>
      <span className="font-bold">{workplaceTypeLabel(primary)}</span>
      {secondary != null && (
        <>
          {" / "}
          <span className="font-normal">{workplaceTypeLabel(secondary)}</span>
        </>
      )}
    </span>
  );
}
