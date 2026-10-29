"use client";

import { useId, useMemo, useState } from "react";
import { MAX_COMPANY_PERKS, perkDefinition, searchPerks, type PerkKey } from "@iwtr/shared-types";
import { FallbackPerkIcon, PERK_ICONS } from "@/lib/perkIcons";
import { useT } from "@/lib/i18n/client";

/**
 * The owner dashboard's Perks ("Yan Haklar") box: the picked perks as chips
 * with a remove button, and a search box that suggests perks from the
 * catalogue as the owner types ("Yem" -> Yemek Kartı, "Meal" -> Meal card).
 * Nothing free-typed is ever kept: only a suggestion can be added.
 */
export function PerksPicker({ value, onChange }: { value: PerkKey[]; onChange: (next: PerkKey[]) => void }) {
  const t = useT();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const full = value.length >= MAX_COMPANY_PERKS;
  const suggestions = useMemo(() => (full ? [] : searchPerks(query, value)), [query, value, full]);

  function add(key: PerkKey) {
    if (value.includes(key) || full) return;
    onChange([...value, key]);
    setQuery("");
    setActive(0);
  }

  function remove(key: PerkKey) {
    onChange(value.filter((k) => k !== key));
  }

  return (
    <div>
      {value.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((key) => {
            const p = perkDefinition(key);
            if (!p) return null;
            const Icon = PERK_ICONS[key] ?? FallbackPerkIcon;
            const name = t(p.en);
            return (
              <li key={key} className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted py-1 pl-2.5 pr-1 text-[13px] font-medium text-foreground">
                <Icon size={14} aria-hidden="true" className="text-muted-foreground" />
                {name}
                <button
                  type="button"
                  onClick={() => remove(key)}
                  aria-label={t("Remove {perk}", { perk: name })}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-border/70 hover:text-foreground"
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-2 text-xs text-muted-foreground">{t("No perks listed yet.")}</p>
      )}

      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={suggestions.length > 0 ? `${listId}-${active}` : undefined}
          value={query}
          disabled={full}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (suggestions.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              add(suggestions[active].key as PerkKey);
            } else if (e.key === "Escape") {
              setQuery("");
            }
          }}
          placeholder={full ? t("You've picked the most perks you can.") : t("Search perks, e.g. meal card")}
          className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground disabled:opacity-60"
        />
        {query.trim() && !full && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl bg-surface p-1 shadow-lg ring-1 ring-border"
          >
            {suggestions.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">{t("No perk matches that. Try another word.")}</li>
            ) : (
              suggestions.map((p, i) => {
                const Icon = PERK_ICONS[p.key as PerkKey] ?? FallbackPerkIcon;
                return (
                  <li
                    key={p.key}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => {
                      // Keep focus in the box, then add.
                      e.preventDefault();
                      add(p.key as PerkKey);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
                      i === active ? "bg-surface-muted text-foreground" : "text-foreground/85"
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground ring-1 ring-inset ring-border">
                      <Icon size={13} aria-hidden="true" />
                    </span>
                    {t(p.en)}
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{t("Pick from the list. You can choose up to {n}.", { n: MAX_COMPANY_PERKS })}</p>
    </div>
  );
}
