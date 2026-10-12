"use client";

import Image from "next/image";
import type { WorkplaceType } from "@iwtr/shared-types";
import { WORKPLACE_TYPES } from "@/lib/workplaceTypes";
import { collarTileTone } from "@/lib/collarColors";

// The site's own beaver, dressed for each kind of work.
const WORK_TYPE_ART: Record<WorkplaceType, string> = {
  OFFICE: "/office1.png",
  HYBRID_REMOTE: "/hybrid1.png",
  SERVICE: "/service1.png",
  MANUAL_LABOUR: "/manuallabour1.png",
};

/**
 * The Work-Type buttons: four tiles, each with its name and the beaver
 * dressed for that kind of work peeking up from the bottom edge. A tile at
 * rest is quiet - grey beaver, plain name. A picked tile takes its work
 * type's own colour as a soft wash with a short bar of that colour under
 * the name, and its beaver turns to full colour (the same "grey until it's
 * yours" idea as the mood beavers on the Rating slider).
 *
 * `columns` 2 is the filter sidebar on the Rating and Jobs pages; 4 is the
 * wide "What kind of work?" row on Edit Profile.
 */
export function WorkTypeTiles({
  selected,
  onToggle,
  columns = 2,
  disabled = false,
}: {
  selected: WorkplaceType[];
  onToggle: (value: WorkplaceType) => void;
  columns?: 2 | 4;
  disabled?: boolean;
}) {
  return (
    <div className={`grid gap-1.5 ${columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
      {WORKPLACE_TYPES.map((t) => {
        const on = selected.includes(t.value);
        const tone = collarTileTone[t.value];
        return (
          <button
            key={t.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(t.value)}
            className={`group relative flex h-[5.25rem] flex-col items-start overflow-hidden rounded-xl text-left transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
              on ? tone.wash : "bg-surface-muted/70 hover:bg-surface-muted"
            }`}
          >
            <span
              className={`relative z-10 block whitespace-nowrap px-2.5 pt-2 text-xs leading-tight transition-colors ${
                on ? "font-bold text-foreground" : "font-medium text-muted-foreground group-hover:text-foreground"
              }`}
            >
              {t.label}
            </span>
            <span
              aria-hidden="true"
              className={`ml-2.5 mt-1.5 block h-[3px] w-5 shrink-0 rounded-full transition-all duration-200 ${
                on ? tone.bar : "w-0 bg-transparent"
              }`}
            />
            <Image
              src={WORK_TYPE_ART[t.value]}
              alt=""
              width={144}
              height={192}
              sizes="72px"
              className={`pointer-events-none absolute -bottom-3.5 right-0.5 h-[4.5rem] w-auto select-none transition duration-200 ${
                on ? "" : "opacity-50 grayscale group-hover:opacity-90 group-hover:grayscale-0"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
