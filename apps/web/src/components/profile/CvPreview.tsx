"use client";

import { useEffect, useState } from "react";
import type { MyEmploymentEntry, MyProfile } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { Avatar } from "@/components/Avatar";

function formatRange(startDate: string | null, endDate: string | null): string {
  const start = startDate ? new Date(startDate).getFullYear() : "?";
  const end = endDate ? new Date(endDate).getFullYear() : "Present";
  return `${start} - ${end}`;
}

// The single source of truth for what a CV looks like — both the live
// preview on /me and Task 6's PDF generation render this exact component
// (html2pdf.js snapshots this component's DOM node directly), so the PDF a
// company receives always matches what the applicant saw on screen.
export function CvPreview({ profile, id }: { profile: MyProfile; id?: string }) {
  const [employment, setEmployment] = useState<MyEmploymentEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiGet<MyEmploymentEntry[]>("/me/employment-history").then((data) => {
      if (!cancelled) setEmployment(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const name = profile.displayName?.trim() || "Your name here";
  const hasAnyExperience = employment.length > 0 || !!profile.customExperienceText;

  return (
    <div
      id={id}
      className="flex aspect-[1/1.414] w-full flex-col gap-4 overflow-y-auto border border-slate-800 bg-zinc-50 p-6 font-jakarta text-slate-900 dark:bg-zinc-50 dark:text-slate-900"
    >
      <header className="flex items-center gap-4 border-b border-slate-800 pb-4">
        <Avatar avatarKey={profile.avatarKey} avatarGradient={profile.avatarGradient} size="md" />
        <div className="min-w-0">
          <h1 className="truncate font-grotesk text-2xl font-bold">{name}</h1>
          <p className="truncate text-sm text-slate-600">
            {profile.email}
            {profile.phoneNumber ? ` · ${profile.phoneNumber}` : ""}
          </p>
          {profile.isPublicEmployee && (
            <span className="mt-1 inline-block rounded-none border border-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              Public Sector Employee
            </span>
          )}
        </div>
      </header>

      <section>
        <h2 className="font-grotesk text-xs font-bold uppercase tracking-wide text-slate-600">Employment History</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {!hasAnyExperience && <li className="text-sm text-slate-500">Nothing added yet.</li>}
          {employment.map((e) => (
            <li key={e.id} className="text-sm">
              <p className="font-bold">{e.jobTitle ?? "Employee"} — {e.rawCompanyName}</p>
              <p className="text-xs text-slate-600">{formatRange(e.startDate, e.endDate)}</p>
            </li>
          ))}
          {profile.customExperienceText && (
            <li className="whitespace-pre-wrap text-sm">{profile.customExperienceText}</li>
          )}
        </ul>
      </section>
    </div>
  );
}
