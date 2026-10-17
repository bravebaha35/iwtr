"use client";

import { useEffect, useMemo, useState } from "react";
import { MAX_SKILLS_PER_MEMBER, type Skill } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";

// How many matches are listed under the search box at once.
const MAX_RESULTS = 8;

// Lower-case with Turkish letters folded to plain ones, so "isci" finds
// "Isci" and "CNC" finds "cnc".
function fold(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Skills whose name matches the search, best first: names that start with
 * it, then names with a word that starts with it, then names that merely
 * contain it.
 */
export function matchSkills(all: Skill[], query: string, excludeIds: string[]): Skill[] {
  const q = fold(query.trim());
  if (!q) return [];
  const starts: Skill[] = [];
  const wordStarts: Skill[] = [];
  const contains: Skill[] = [];
  for (const skill of all) {
    if (excludeIds.includes(skill.id)) continue;
    const name = fold(skill.name);
    if (name.startsWith(q)) starts.push(skill);
    else if (name.split(/[\s/(&-]+/).some((word) => word.startsWith(q))) wordStarts.push(skill);
    else if (name.includes(q)) contains.push(skill);
  }
  return [...starts, ...wordStarts, ...contains];
}

/**
 * Verified skills on Edit Profile: a search box instead of the whole list.
 * The member types, picks from the few matches shown under the box, and
 * their chosen skills (10 at most) sit below as removable chips. The list
 * itself is fetched once and searched in the browser, so typing sends
 * nothing to the server.
 */
export function SkillsPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const t = useT();

  useEffect(() => {
    let cancelled = false;
    apiGet<Skill[]>("/skills")
      .then((data) => {
        if (!cancelled) setAllSkills(data);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const full = selectedIds.length >= MAX_SKILLS_PER_MEMBER;
  const matches = useMemo(() => matchSkills(allSkills, query, selectedIds), [allSkills, query, selectedIds]);
  const shown = matches.slice(0, MAX_RESULTS);
  // In the order the member picked them.
  const selected = selectedIds
    .map((id) => allSkills.find((s) => s.id === id))
    .filter((s): s is Skill => s !== undefined);

  function add(id: string) {
    if (full || selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
    setQuery("");
  }

  function remove(id: string) {
    onChange(selectedIds.filter((s) => s !== id));
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor="skill-search" className="text-xs font-medium text-muted-foreground">
          {t("Verified skills")}
        </label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {selectedIds.length} / {MAX_SKILLS_PER_MEMBER}
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <input
          id="skill-search"
          type="search"
          autoComplete="off"
          value={query}
          disabled={full}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && shown.length > 0) {
              e.preventDefault();
              add(shown[0].id);
            }
          }}
          placeholder={
            full ? t("You've picked 10 - remove one to add another") : t("Search a skill: welding, Excel, barista, forklift...")
          }
          className="w-full rounded-full border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-surface-muted"
        />
      </div>

      {loadFailed && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-300">{t("Couldn't load the skill list. Reload the page to try again.")}</p>
      )}

      {query.trim() !== "" && !loadFailed && (
        <ul aria-label={t("Matching skills")} className="mt-2 flex flex-col gap-0.5 rounded-xl bg-surface-muted/60 p-1.5">
          {shown.length === 0 && (
            <li className="px-2.5 py-2 text-sm text-muted-foreground">
              {t("No skill matches “{q}”. Try a shorter or different word.", { q: query.trim() })}
            </li>
          )}
          {shown.map((skill) => (
            <li key={skill.id}>
              <button
                type="button"
                onClick={() => add(skill.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition hover:bg-surface"
              >
                <span>{skill.name}</span>
                <span className="shrink-0 text-xs font-semibold text-brand-700 dark:text-brand-300">{t("Add")}</span>
              </button>
            </li>
          ))}
          {matches.length > shown.length && (
            <li className="px-2.5 pb-1 pt-1.5 text-xs text-muted-foreground">
              {t("{n} more - keep typing to narrow it down.", { n: matches.length - shown.length })}
            </li>
          )}
        </ul>
      )}

      {selected.length > 0 ? (
        <ul aria-label={t("Your skills")} className="mt-3 flex flex-wrap gap-1.5">
          {selected.map((skill) => (
            <li key={skill.id}>
              <button
                type="button"
                onClick={() => remove(skill.id)}
                title={t("Remove {name}", { name: skill.name })}
                aria-label={t("Remove {name}", { name: skill.name })}
                className="group flex items-center gap-1.5 rounded-full bg-brand-600 py-1 pl-3 pr-2 text-xs font-semibold text-white transition hover:bg-brand-700"
              >
                {skill.name}
                <svg viewBox="0 0 24 24" className="h-3 w-3 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("Up to {n} skills, shown on your CV. Nothing picked yet.", { n: MAX_SKILLS_PER_MEMBER })}
        </p>
      )}
    </div>
  );
}
