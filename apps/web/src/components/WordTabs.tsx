"use client";

import { useRef } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * Plain-word tabs on a hairline, with a Wood bar under the open one - the
 * same "selected" look as the header nav and the company page's tabs, sized
 * for use inside a page section (IWT Social's Explore / Following / Saved,
 * the company Social tab's Posts / Photos). Left / Right move between tabs.
 */
export function WordTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  // What this group of tabs switches, for screen readers.
  label: string;
}) {
  const t = useT();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const current = tabs.findIndex((t) => t.value === value);
    const next = (current + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label={t(label)} onKeyDown={onKeyDown} className="flex items-end gap-6 border-b border-border">
      {tabs.map((tab, i) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={`-mb-px min-h-11 shrink-0 border-b-[3px] px-0.5 pb-2.5 pt-2 text-[15px] font-semibold leading-none transition-colors ${
              selected
                ? "border-brand-600 text-foreground dark:border-brand-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(tab.label)}
          </button>
        );
      })}
    </div>
  );
}
