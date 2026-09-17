"use client";

import type { WorkplaceType } from "@iwtr/shared-types";
import { WORKPLACE_TYPES } from "@/lib/workplaceTypes";

// The "what kind of work?" 4-button grid — standalone so it can be placed
// anywhere a work-type needs picking (Personal Information tab) without
// dragging AvatarEditor's avatar/background UI along with it. AvatarEditor
// still renders this exact grid itself when uncontrolled (onboarding) — see
// its own doc comment.
export function WorkTypePicker({
  value,
  onChange,
}: {
  value: WorkplaceType | null;
  onChange: (type: WorkplaceType) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {WORKPLACE_TYPES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={`rounded-lg p-2 text-[10px] font-medium transition ${
            value === t.value
              ? "bg-brand-100 ring-2 ring-brand-600 dark:bg-brand-900/60"
              : "text-muted-foreground hover:bg-surface-muted"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
