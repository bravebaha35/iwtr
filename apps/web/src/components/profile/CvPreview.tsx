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
//
// Every color below is an arbitrary hex value (e.g. bg-[#fafafa]) rather
// than Tailwind's named zinc-*/slate-* palette utility. This is required,
// not stylistic: Tailwind v4's default palette compiles those utility names
// to oklch() colors, and html2canvas (the library html2pdf.js uses to
// snapshot this component) throws "Attempting to parse an unsupported color
// function" on any oklch() value — which silently broke every Apply click,
// since the throw landed in a bare catch. The hex values used here are the
// real Tailwind v3-era sRGB stops for the same color-stop names, so the
// rendered look is unchanged. Do not swap these back to named
// zinc-*/slate-* utilities, and do not add new zinc-*/slate-* classes to
// this file — only CvPreview.tsx is ever snapshotted by html2canvas.
export function CvPreview({
  profile,
  employment: employmentProp,
  id,
  showEmail = false,
  showPhone = false,
  forPrint = false,
}: {
  profile: MyProfile;
  // Optional pre-fetched employment history. Only ApplyButton.tsx's hidden
  // snapshot instance passes this: it fetches /me/employment-history itself
  // (in parallel with /me/profile, before ever mounting this component) so
  // the PDF snapshot never races this component's own fetch below. The live
  // preview on /me omits this prop and keeps the self-fetch behavior.
  employment?: MyEmploymentEntry[];
  id?: string;
  // Both default OFF — see Fix 2 in the 2026-09-16 final-review fix report.
  // profile.email/profile.phoneNumber are decrypted, self-view-only account
  // fields the member never explicitly typed for this purpose, so neither
  // is ever rendered unless the member has opted in via the checkboxes on
  // /me's "My CV" tab (lib/cvDisclosurePrefs.ts). ApplyButton.tsx's hidden
  // snapshot instance must be passed the same two values the member last
  // saw checked on /me, so the PDF a company receives always matches what
  // was on screen.
  showEmail?: boolean;
  showPhone?: boolean;
  // When true, drop the fixed aspect-ratio + scroll box used for the
  // on-screen preview and render at natural height instead. html2canvas
  // snapshots this element's box exactly as laid out, with no scrolling, so
  // the on-screen aspect-ratio box would otherwise silently clip a long CV.
  // ApplyButton.tsx's hidden snapshot instance always passes this as true.
  forPrint?: boolean;
}) {
  const [employmentState, setEmploymentState] = useState<MyEmploymentEntry[]>(employmentProp ?? []);

  useEffect(() => {
    // A caller that already fetched employment history (ApplyButton, to
    // avoid racing its own snapshot against this component's own fetch)
    // opts this effect out entirely.
    if (employmentProp) return;
    let cancelled = false;
    apiGet<MyEmploymentEntry[]>("/me/employment-history")
      .then((data) => {
        if (!cancelled) setEmploymentState(data);
      })
      .catch(() => {
        if (!cancelled) setEmploymentState([]);
      });
    return () => {
      cancelled = true;
    };
  }, [employmentProp]);

  const employment = employmentProp ?? employmentState;
  const name = profile.displayName?.trim() || "Your name here";
  const hasAnyExperience = employment.length > 0 || !!profile.customExperienceText;
  const contactLine = [showEmail ? profile.email : null, showPhone ? profile.phoneNumber : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      id={id}
      className={`flex w-full flex-col gap-4 border border-[#1e293b] bg-[#fafafa] p-6 font-jakarta text-[#0f172a] dark:bg-[#fafafa] dark:text-[#0f172a]${
        forPrint ? "" : " aspect-[1/1.414] overflow-y-auto"
      }`}
    >
      <header className="flex items-center gap-4 border-b border-[#1e293b] pb-4">
        <Avatar avatarKey={profile.avatarKey} avatarGradient={profile.avatarGradient} size="md" />
        <div className="min-w-0">
          <h1 className="truncate font-grotesk text-2xl font-bold">{name}</h1>
          {contactLine && <p className="truncate text-sm text-[#475569]">{contactLine}</p>}
          {profile.isPublicEmployee && (
            <span className="mt-1 inline-block rounded-none border border-[#1e293b] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              Public Sector Employee
            </span>
          )}
        </div>
      </header>

      <section>
        <h2 className="font-grotesk text-xs font-bold uppercase tracking-wide text-[#475569]">Employment History</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {!hasAnyExperience && <li className="text-sm text-[#64748b]">Nothing added yet.</li>}
          {employment.map((e) => (
            <li key={e.id} className="text-sm">
              <p className="font-bold">{e.jobTitle ?? "Employee"} — {e.rawCompanyName}</p>
              <p className="text-xs text-[#475569]">{formatRange(e.startDate, e.endDate)}</p>
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
