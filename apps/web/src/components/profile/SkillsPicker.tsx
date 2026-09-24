"use client";

import { useEffect, useState } from "react";
import { MAX_SKILLS_PER_MEMBER, type Skill } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";

// Magnetic-snap hover (a small scale bump that "catches" the cursor) + a
// crisp, high-contrast active state — both pure CSS via Tailwind's
// transition/scale utilities, no extra library needed for an effect this
// small.
export function SkillsPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [allSkills, setAllSkills] = useState<Skill[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiGet<Skill[]>("/skills")
      .then((data) => {
        if (!cancelled) setAllSkills(data);
      })
      .catch(() => {
        if (!cancelled) setAllSkills([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
      return;
    }
    if (selectedIds.length >= MAX_SKILLS_PER_MEMBER) return;
    onChange([...selectedIds, id]);
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-widest">Select up to 10 verified skills.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {allSkills.map((skill) => {
          const selected = selectedIds.includes(skill.id);
          const disabled = !selected && selectedIds.length >= MAX_SKILLS_PER_MEMBER;
          return (
            <button
              key={skill.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(skill.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition duration-150 ease-out hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ${
                selected
                  ? "border-brand-600 bg-brand-600 text-slate-950"
                  : "border-border text-muted-foreground hover:border-brand-600 hover:text-foreground"
              }`}
            >
              {skill.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
