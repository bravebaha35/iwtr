"use client";

import Image from "next/image";
import type { WorkplaceType } from "@iwtr/shared-types";
import { WORKPLACE_TYPES } from "@/lib/workplaceTypes";
import { useT } from "@/lib/i18n/client";

// One object per kind of work, drawn for these tiles: a pencil, a headset,
// two hands reaching for each other, a hard hat. Square art on a clear
// background; the files keep the names the owner gave them (%20 = the space).
// `place` sits each one in the tile's bottom-right corner. The square files
// have empty margins of their own, so the negative offsets only cancel those:
// the drawn object itself stays about 6px inside the tile's edge. The hands
// are the one exception - drawn corner to corner, they run off the bottom-left
// and right edges on purpose, with the fingertips near the tile's middle.
const WORK_TYPE_ART: Record<WorkplaceType, { src: string; place: string }> = {
  OFFICE: { src: "/Office%20QS.webp", place: "-bottom-[14px] -right-px h-20 w-20" },
  HYBRID_REMOTE: { src: "/Hybrid%20QS.webp", place: "-bottom-[9px] -right-[2px] h-16 w-16" },
  SERVICE: { src: "/Service%20QS.webp", place: "-bottom-[10px] -right-[6px] h-24 w-24" },
  MANUAL_LABOUR: { src: "/Manual-Labour%20QS.webp", place: "-bottom-[23px] -right-[4px] h-[5.25rem] w-[5.25rem]" },
};

/**
 * The Work-Type buttons: four tiles, each with its name and the object
 * that stands for that kind of work in the bottom corner. A tile at rest is
 * quiet - grey object, plain name. A picked tile takes its work type's own
 * colour as a soft wash with a short bar of that colour under the name, and
 * its object turns to full colour (the same "grey until it's yours" idea as
 * the mood beavers on the Rating slider).
 *
 * `columns` 2 is the filter sidebar on the Rating and Jobs pages; 4 is the
 * wide "What kind of work?" row on Edit Profile. `tone` "surface" is for a
 * column whose other sections are white panels (IWT Social's sidebar): a
 * tile at rest is then a small white panel itself instead of a grey one.
 */
export function WorkTypeTiles({
  selected,
  onToggle,
  columns = 2,
  disabled = false,
  tone = "muted",
}: {
  selected: WorkplaceType[];
  onToggle: (value: WorkplaceType) => void;
  columns?: 2 | 4;
  disabled?: boolean;
  tone?: "muted" | "surface";
}) {
  const tr = useT();
  return (
    <div className={`grid gap-1.5 ${columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
      {WORKPLACE_TYPES.map((t) => {
        const on = selected.includes(t.value);
        const art = WORK_TYPE_ART[t.value];
        return (
          <button
            key={t.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(t.value)}
            className={`group relative flex h-[5.25rem] flex-col items-start overflow-hidden rounded-xl text-left transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
              on ? "bg-brand-600/12 dark:bg-brand-400/15" : tone === "surface" ? "bg-surface shadow-xs hover:bg-surface-muted/40" : "bg-surface-muted/70 hover:bg-surface-muted"
            }`}
          >
            <span
              className={`relative z-10 block whitespace-nowrap px-2.5 pt-2 text-xs leading-tight transition-colors ${
                on ? "font-bold text-brand-700 dark:text-brand-300" : "font-medium text-muted-foreground group-hover:text-foreground"
              }`}
            >
              {tr(t.label)}
            </span>
            <span
              aria-hidden="true"
              className={`ml-2.5 mt-1.5 block h-[3px] w-5 shrink-0 rounded-full transition-all duration-200 ${
                on ? "bg-brand-600 dark:bg-brand-400" : "w-0 bg-transparent"
              }`}
            />
            <Image
              src={art.src}
              alt=""
              width={160}
              height={160}
              sizes="80px"
              className={`pointer-events-none absolute select-none transition duration-200 ${art.place} ${
                on ? "" : "opacity-50 grayscale group-hover:opacity-90 group-hover:grayscale-0"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
