"use client";

import { useEffect, useState } from "react";
import type { EduLevel, MyEmploymentEntry, MyProfile } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { Avatar } from "@/components/Avatar";

function formatRange(startDate: string | null, endDate: string | null): string {
  const start = startDate ? new Date(startDate).getFullYear() : "?";
  const end = endDate ? new Date(endDate).getFullYear() : "Present";
  return `${start} - ${end}`;
}

const EDU_LEVEL_LABELS: Record<EduLevel, string> = {
  ELEMENTARY: "Elementary School",
  HIGH_SCHOOL: "High School",
  COLLEGE: "College",
};

function formatEducationDetail(level: EduLevel, faculty: string | null | undefined, department: string | null | undefined, graduationYear: number | null | undefined): string {
  return [EDU_LEVEL_LABELS[level], faculty, department, graduationYear ? `Class of ${graduationYear}` : null]
    .filter(Boolean)
    .join(" · ");
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
//
// Second html2canvas constraint, same reasoning: this version of html2canvas
// does not support the CSS `gap` property on flex/grid containers (it's
// silently dropped, collapsing every gapped child to zero spacing — this is
// what made the avatar and name overlap in the rendered PDF even though the
// live on-screen preview, which never goes through html2canvas, looked
// correct). Use `space-x-*`/`space-y-*` (margin-based) for spacing in this
// file instead of `gap-*`, never `gap-*` itself.
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
  const contactLine = [showEmail ? profile.email : null, showPhone ? profile.phoneNumber : null]
    .filter(Boolean)
    .join(" · ");
  // "Where the member is based" — no birthplace field exists anywhere in the
  // system (deliberately: it would need new encrypted PiiVault storage, same
  // protection level as national ID, for a cosmetic CV line), so this is the
  // member's current location instead, already collected at onboarding.
  const locationLine = [profile.district, profile.city, profile.country].filter(Boolean).join(", ");
  const education = profile.education;
  const WORK_TYPE_LABELS: Record<string, string> = {
    OFFICE: "Office",
    HYBRID_REMOTE: "Hybrid/Remote",
    SERVICE: "Service",
    MANUAL_LABOUR: "Manual Labour",
  };
  const workTypeLabel = profile.workType ? WORK_TYPE_LABELS[profile.workType] : null;

  return (
    <div
      id={id}
      className={`relative flex w-full flex-col border border-[#1e293b] bg-[#fafafa] p-6 font-jakarta text-[#0f172a] dark:bg-[#fafafa] dark:text-[#0f172a]${
        forPrint ? "" : " aspect-[1/1.414] overflow-y-auto"
      }`}
    >
      <section>
        <h2 className="font-grotesk text-xs font-bold uppercase tracking-wide text-[#475569]">
          Personal Information
        </h2>
        <div className="mt-3 flex items-center space-x-4">
          <Avatar avatarKey={profile.avatarKey} avatarGradient={profile.avatarGradient} size="md" />
          <div className="min-w-0">
            <h1 className="truncate font-grotesk text-2xl font-bold leading-tight">{name}</h1>
            {contactLine && <p className="truncate text-sm text-[#475569]">{contactLine}</p>}
            {locationLine && <p className="truncate text-sm text-[#475569]">{locationLine}</p>}
          </div>
        </div>
        {/* Nested wrapper + negative-margin children is a margin-based
            substitute for `gap` on a flex-wrap row (this file may never use
            `gap-*` — see file-level comment above). The outer div carries
            only the mt-3 section spacing; the inner div carries the
            negative margin that the mt-6/ml-6-style child margins offset,
            so wrapped rows still get consistent horizontal+vertical
            spacing. */}
        <div className="mt-3 text-sm text-[#475569]">
          <div className="-ml-6 -mt-1 flex flex-wrap">
            {profile.birthDate && <span className="ml-6 mt-1">Born {new Date(profile.birthDate).getFullYear()}</span>}
            {workTypeLabel && <span className="ml-6 mt-1">{workTypeLabel}</span>}
            {profile.sector && <span className="ml-6 mt-1">{profile.sector.label}</span>}
          </div>
        </div>
        {profile.isPublicEmployee && (
          <span className="mt-2 inline-block rounded-none border border-[#1e293b] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            Public Sector Employee
          </span>
        )}
        {profile.skills.length > 0 && (
          <div className="mt-3">
            <div className="-ml-1.5 -mt-1.5 flex flex-wrap">
              {profile.skills.map((s) => (
                <span
                  key={s.id}
                  className="ml-1.5 mt-1.5 rounded-full border border-[#1e293b] px-2 py-0.5 text-[11px] font-medium"
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {profile.customExperienceText && (
          <p className="mt-3 whitespace-pre-wrap text-sm">{profile.customExperienceText}</p>
        )}
      </section>

      <hr className="my-8 border-t border-[#1e293b]" />

      {education.length > 0 && (
        <>
          <section>
            <h2 className="font-grotesk text-xs font-bold uppercase tracking-wide text-[#475569]">Education</h2>
            <ul className="mt-2 flex flex-col space-y-2">
              {education.map((e) => (
                <li key={e.id} className="text-sm">
                  <p className="font-bold">{e.institutionName}</p>
                  <p className="text-xs text-[#475569]">
                    {formatEducationDetail(e.level, e.faculty, e.department, e.graduationYear)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <hr className="my-8 border-t border-[#1e293b]" />
        </>
      )}

      <section>
        <h2 className="font-grotesk text-xs font-bold uppercase tracking-wide text-[#475569]">Employment History</h2>
        <ul className="mt-2 flex flex-col space-y-2">
          {employment.length === 0 && <li className="text-sm text-[#64748b]">Nothing added yet.</li>}
          {employment.map((e) => (
            <li key={e.id} className="text-sm">
              <p className="font-bold">{e.jobTitle ?? "Employee"} — {e.rawCompanyName}</p>
              <p className="text-xs text-[#475569]">{formatRange(e.startDate, e.endDate)}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-8 flex flex-col items-start border-t border-[#1e293b] pt-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- snapshotted by html2canvas, which can't resolve next/image's optimized/lazy output */}
        <img src="/realicon.png" alt="I Worked There" className="h-6 w-6" />
        <p className="mt-1 text-[10px] font-bold text-[#0f172a]">Made in iworkedthere.com</p>
      </footer>
    </div>
  );
}
