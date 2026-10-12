"use client";

import type { WorkplaceType } from "@iwtr/shared-types";
import { WorkTypeTiles } from "@/components/WorkTypeTiles";

// The "what kind of work?" row - standalone so it can be placed anywhere a
// single work-type needs picking (Personal Information tab) without
// dragging AvatarEditor's avatar/background UI along with it. AvatarEditor
// still renders this exact row itself when uncontrolled (onboarding) - see
// its own doc comment. Same tiles as the Work-Type filter (WorkTypeTiles),
// four across, one picked at a time.
export function WorkTypePicker({
  value,
  onChange,
}: {
  value: WorkplaceType | null;
  onChange: (type: WorkplaceType) => void;
}) {
  return <WorkTypeTiles columns={4} selected={value ? [value] : []} onToggle={onChange} />;
}
