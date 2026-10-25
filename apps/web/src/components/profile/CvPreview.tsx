"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { languageLabel, type EduLevel, type MyEmploymentEntry, type MyProfile } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { jobPositionLabel } from "@/lib/jobPositions";
import { RichText } from "@/components/RichText";
import type { CvSectionKey } from "@/lib/cvDisclosurePrefs";
import { useI18n } from "@/lib/i18n/client";
import { intlLocale, languageName, type Locale, type TFn } from "@/lib/i18n/core";

// The A4 page width in CSS pixels (210 mm at 96 dpi). The CV is always laid
// out at this width - on screen it is scaled down (CvPage), in the PDF it is
// printed as is - so the preview and the PDF wrap every line the same way.
export const CV_PAGE_WIDTH_PX = 794;
// An A4 sheet's height at that width.
const A4_HEIGHT_PX = Math.round(CV_PAGE_WIDTH_PX * 1.414);
// One white sheet of paper on screen. In the PDF the shadow and the fixed
// height go (globals.css, .cv-printing).
const SHEET = "cv-sheet flex flex-col rounded-[4px] bg-[#ffffff] shadow-[0_6px_28px_rgba(20,30,22,0.16)]";

// Colours are plain hex on purpose: this element is photographed by
// html2canvas for the PDF, and html2canvas can't read Tailwind v4's oklch()
// palette. The same snapshot also rules out, in this file only:
//   - `gap-*` on flex/grid containers (dropped silently): use margins / space-*
//   - negative margins on flex rows (overlaps in the PDF)
//   - `truncate` / `line-clamp` (wrong box heights, overlapping lines)
// Every one of these looked fine live and broke only in the real PDF.
const INK = "#18241b"; // deep pine text
const MUTED = "#5b6659";
const FAINT = "#8a9387";
const RULE = "#d9ddd4";
const ACCENT = "#8b5a2b"; // Wood, the site's one accent
const SIDE_BG = "#f1f3ee";

const EDU_LEVEL_LABELS: Record<EduLevel, string> = {
  ELEMENTARY: "Elementary School",
  HIGH_SCHOOL: "High School",
  COLLEGE: "College",
};

function monthYear(iso: string | null, locale: Locale): string | null {
  if (!iso) return null;
  const [y, m] = iso.split("-").map(Number);
  if (!y) return null;
  return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString(intlLocale(locale), {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dateRange(start: string | null, end: string | null, t: TFn, locale: Locale): string {
  const from = monthYear(start, locale);
  const to = monthYear(end, locale) ?? t("Present");
  return from ? `${from} - ${to}` : to;
}

// Newest job first; a job with no end date is the current one.
function byMostRecent(a: MyEmploymentEntry, b: MyEmploymentEntry): number {
  const endA = a.endDate ?? "9999";
  const endB = b.endDate ?? "9999";
  if (endA !== endB) return endB.localeCompare(endA);
  return (b.startDate ?? "").localeCompare(a.startDate ?? "");
}

/**
 * One block of the side column: a grey panel holding a single section. Each
 * panel is kept whole on one PDF page, so a long page 1 never leaves a strip
 * of grey behind on page 2 (one full-height grey column used to).
 */
function SidePanel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-[6px] px-5 pb-5 pt-4" style={{ backgroundColor: SIDE_BG, ...KEEP_TOGETHER }}>
      {children}
    </section>
  );
}

// The profile text as separate paragraphs (split on blank lines), each kept
// whole, so the PDF never cuts a line of text in half across two pages.
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function SectionTitle({ children, side = false }: { children: ReactNode; side?: boolean }) {
  return (
    <h2
      className="pb-1.5 text-[15px] leading-tight"
      style={{ color: INK, borderBottom: `1px solid ${side ? "#d3d8cd" : RULE}` }}
    >
      {children}
    </h2>
  );
}

// One block the PDF must not cut across two pages.
const KEEP_TOGETHER = { breakInside: "avoid" as const, pageBreakInside: "avoid" as const };

/** One row: title and date on a line, the place under it. */
function Entry({ title, date, subtitle }: { title: string; date: string | null; subtitle: string }) {
  return (
    <>
      <div className="flex items-baseline justify-between">
        <p className="min-w-0 flex-1 break-words pr-4 text-[13.5px] font-semibold" style={{ color: INK }}>
          {title}
        </p>
        {date && (
          <p className="shrink-0 text-[11.5px]" style={{ color: MUTED }}>
            {date}
          </p>
        )}
      </div>
      {subtitle && (
        <p className="mt-0.5 break-words text-[12.5px]" style={{ color: MUTED }}>
          {subtitle}
        </p>
      )}
    </>
  );
}

/**
 * A titled list. The title travels with the first entry, so a page break
 * never leaves a heading alone at the bottom of a page; every entry is kept
 * whole.
 */
function CvSection({
  title,
  side = false,
  items,
  spacing = "mt-4",
}: {
  title: string;
  side?: boolean;
  items: { key: string; node: ReactNode }[];
  spacing?: string;
}) {
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  return (
    <section>
      <div style={KEEP_TOGETHER}>
        <SectionTitle side={side}>{title}</SectionTitle>
        <div className="mt-3">{first.node}</div>
      </div>
      {rest.map((item) => (
        <div key={item.key} className={spacing} style={KEEP_TOGETHER}>
          {item.node}
        </div>
      ))}
    </section>
  );
}

/**
 * The CV: one source for the on-screen preview (Edit Profile > My CV), the
 * PDF a member downloads, and the PDF sent with a job application
 * (ApplyButton). Everything on it is the member's own data from Edit
 * Profile; the anonymous avatar never appears - only the CV photo, if the
 * member added one.
 */
export function CvPreview({
  profile,
  employment: employmentProp,
  id,
  showEmail = false,
  showPhone = false,
  hiddenSections = [],
}: {
  profile: MyProfile;
  // Pre-fetched by ApplyButton so its PDF snapshot never races the fetch
  // below. The preview on /me leaves it out and fetches its own.
  employment?: MyEmploymentEntry[];
  id?: string;
  // Both off unless the member ticked them on My CV (lib/cvDisclosurePrefs).
  showEmail?: boolean;
  showPhone?: boolean;
  // Kept for callers; the page is always laid out at full A4 width now.
  forPrint?: boolean;
  // Sections the member switched off on My CV (lib/cvDisclosurePrefs).
  hiddenSections?: CvSectionKey[];
}) {
  const [employmentState, setEmploymentState] = useState<MyEmploymentEntry[]>(employmentProp ?? []);
  const { t, locale } = useI18n();

  useEffect(() => {
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

  const employment = [...(employmentProp ?? employmentState)].sort(byMostRecent);
  const name = profile.displayName?.trim() || t("Your name here");
  const locationLine = [profile.district, profile.city, profile.country].filter(Boolean).join(", ");
  const headline = [
    profile.workType ? t(workplaceTypeLabel(profile.workType)) : null,
    profile.sector ? t(profile.sector.label) : null,
  ]
    .filter(Boolean)
    .join("  /  ");
  const languages = (profile.languages ?? []).map((code) => languageName(code, languageLabel(code), locale));
  const references = profile.references ?? [];
  const certificates = profile.certificates ?? [];
  const contact = [
    showEmail && profile.email ? { label: t("Email"), value: profile.email } : null,
    showPhone && profile.phoneNumber ? { label: t("Phone"), value: profile.phoneNumber } : null,
  ].filter((c): c is { label: string; value: string } => c !== null);
  const born = profile.birthDate ? new Date(profile.birthDate).getFullYear() : null;

  const show = (section: CvSectionKey) => !hiddenSections.includes(section);
  const footer = (
    // At the bottom of each sheet on screen. In the PDF it is stamped onto
    // every page instead (lib/cvPdfFooter.ts), so this copy is left out then.
    <footer className="cv-page-footer mt-auto flex items-center px-12 pb-5 pt-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- photographed by html2canvas */}
      <img src="/realicon.png" alt="" className="mr-2 h-6 w-6 shrink-0 object-contain" />
      <p className="text-[11px] font-semibold leading-none" style={{ color: MUTED }}>
        {t("Made in iworkedthere.com")}
      </p>
    </footer>
  );
  const hasDetails = born !== null || profile.workType !== null || profile.sector !== null;
  const showSkills = show("skills") && profile.skills.length > 0;
  const showLanguages = show("languages") && languages.length > 0;
  const showReferences = show("references") && references.length > 0;
  const hasSecondSheet = show("experience") || (show("certificates") && certificates.length > 0) || (show("education") && profile.education.length > 0);

  return (
    <div id={id} className="cv-document flex flex-col gap-6 font-sans" style={{ width: CV_PAGE_WIDTH_PX, color: INK }}>
      {/* Sheet 1: who the member is - the profile and skills, with the grey
          side column (details, languages, references). The side column is
          on this sheet only. */}
      <div className={SHEET} style={{ minHeight: A4_HEIGHT_PX }}>
        <header className="flex items-start px-12 pb-7 pt-9">
          {profile.cvPhotoUrl && (
            // A background, not an <img>: html2canvas (the PDF) ignores
            // object-fit and would squash a photo of another shape (older
            // square uploads) into this box, but it does draw
            // background-size: cover. New photos are cropped to exactly 28:33.
            <div
              aria-hidden="true"
              className="mr-7 shrink-0"
              style={{
                width: 112,
                height: 132,
                borderRadius: 6,
                backgroundImage: `url("${profile.cvPhotoUrl}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-[38px] leading-[1.08]" style={{ color: INK }}>
              {name}
            </h1>
            {headline && (
              <p className="mt-2 break-words text-[14px] font-medium" style={{ color: ACCENT }}>
                {headline}
              </p>
            )}
            {locationLine && (
              <p className="mt-1 break-words text-[13px]" style={{ color: MUTED }}>
                {locationLine}
              </p>
            )}
            {profile.isPublicEmployee && (
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: MUTED }}>
                {t("Public Sector Employee")}
              </p>
            )}
          </div>
          {contact.length > 0 && (
            <div className="ml-6 shrink-0 text-right">
              {contact.map((c) => (
                <div key={c.label} className="mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: FAINT }}>
                    {c.label}
                  </p>
                  <p className="break-words text-[12.5px]" style={{ color: INK }}>
                    {c.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </header>
        <div className="mx-12" style={{ height: 3, backgroundColor: ACCENT }} />

        {/* Plain divs, not main/aside: the CV sits inside the page's own main area. */}
        <div className="flex flex-1 items-stretch">
          <div className="min-w-0 flex-1 space-y-7 pb-6 pl-12 pr-8 pt-8">
            {show("profile") && profile.customExperienceText && (
              <section>
                {paragraphs(profile.customExperienceText).map((para, i) => (
                  <div key={i} className={i === 0 ? "" : "mt-3"} style={KEEP_TOGETHER}>
                    {i === 0 && <SectionTitle>{t("Profile")}</SectionTitle>}
                    <p
                      className={`${i === 0 ? "mt-3 " : ""}whitespace-pre-wrap break-words text-[12.5px] leading-[1.6]`}
                      style={{ color: INK }}
                    >
                      {para}
                    </p>
                  </div>
                ))}
              </section>
            )}

            {showSkills && (
              <section style={KEEP_TOGETHER}>
                <SectionTitle>{t("Skills")}</SectionTitle>
                {/* A plain two-column list: boxed chips came out of the PDF
                    with their words sitting low in the box. */}
                <ul className="mt-3 flex flex-wrap text-[12.5px] leading-[1.45]" style={{ color: INK }}>
                  {profile.skills.map((s) => (
                    <li key={s.id} className="mb-1.5 break-words pr-4" style={{ width: "50%" }}>
                      {s.name}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="shrink-0 space-y-4 pb-6 pr-12 pt-8" style={{ width: 290 }}>
            {hasDetails && (
              <SidePanel>
                <SectionTitle side>{t("Details")}</SectionTitle>
                <dl className="mt-3 space-y-2.5 text-[12px]">
                  {born && (
                    <div>
                      <dt style={{ color: FAINT }}>{t("Born")}</dt>
                      <dd style={{ color: INK }}>{born}</dd>
                    </div>
                  )}
                  {profile.workType && (
                    <div>
                      <dt style={{ color: FAINT }}>{t("Kind of work")}</dt>
                      <dd style={{ color: INK }}>{t(workplaceTypeLabel(profile.workType))}</dd>
                    </div>
                  )}
                  {profile.sector && (
                    <div>
                      <dt style={{ color: FAINT }}>{t("Sector")}</dt>
                      <dd style={{ color: INK }}>{t(profile.sector.label)}</dd>
                    </div>
                  )}
                </dl>
              </SidePanel>
            )}

            {showLanguages && (
              <SidePanel>
                <SectionTitle side>{t("Languages")}</SectionTitle>
                <ul className="mt-3 space-y-1.5 text-[12.5px]" style={{ color: INK }}>
                  {languages.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </SidePanel>
            )}

            {showReferences && (
              <SidePanel>
                <SectionTitle side>{t("References")}</SectionTitle>
                {references.map((r, i) => (
                    <div key={r.id} className={`text-[12px] ${i === 0 ? "mt-3" : "mt-3.5"}`}>
                      <p className="break-words font-semibold" style={{ color: INK }}>
                        {r.firstName} {r.lastName}
                      </p>
                      <p style={{ color: MUTED }}>{t(jobPositionLabel(r.position))}</p>
                      {r.email && (
                        <p className="break-all" style={{ color: MUTED }}>
                          {r.email}
                        </p>
                      )}
                      {r.phoneNumber && <p style={{ color: MUTED }}>{r.phoneNumber}</p>}
                    </div>
                ))}
              </SidePanel>
            )}
          </div>
        </div>
        {footer}
      </div>

      {/* Sheet 2 onwards: the record - work history, certificates and
          education across the whole width, no side column. Always starts
          on a new page in the PDF. */}
      {hasSecondSheet && (
        <div className={`${SHEET} cv-sheet-2`} style={{ minHeight: A4_HEIGHT_PX, breakBefore: "page", pageBreakBefore: "always" }}>
          <div className="flex-1 space-y-8 px-12 pb-10 pt-11">
            {show("experience") &&
              (employment.length === 0 ? (
                <section style={KEEP_TOGETHER}>
                  <SectionTitle>{t("Experience")}</SectionTitle>
                  <p className="mt-3 text-[12.5px]" style={{ color: FAINT }}>
                    {t("Nothing added yet.")}
                  </p>
                </section>
              ) : (
                <CvSection
                  title={t("Experience")}
                  items={employment.map((e) => ({
                    key: e.id,
                    node: (
                      <Entry
                        title={e.jobTitle ?? t("Employee")}
                        date={dateRange(e.startDate, e.endDate, t, locale)}
                        subtitle={e.rawCompanyName}
                      />
                    ),
                  }))}
                />
              ))}

            {show("certificates") && (
              <CvSection
                title={t("Certificates")}
                spacing="mt-3.5"
                items={certificates.map((c) => ({
                  key: c.id,
                  node: (
                    <>
                      <Entry title={c.name} date={monthYear(c.issuedMonth, locale)} subtitle={c.issuer} />
                      {c.description && (
                        <RichText
                          text={c.description}
                          as="p"
                          className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-[1.55]"
                        />
                      )}
                    </>
                  ),
                }))}
              />
            )}

            {show("education") && (
              <CvSection
                title={t("Education")}
                spacing="mt-3.5"
                items={[...profile.education].reverse().map((e) => ({
                  key: e.id,
                  node: (
                    <Entry
                      title={e.institutionName}
                      date={e.graduationYear ? String(e.graduationYear) : null}
                      subtitle={[t(EDU_LEVEL_LABELS[e.level]), e.faculty, e.department].filter(Boolean).join(", ")}
                    />
                  ),
                }))}
              />
            )}
          </div>
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * The CV page shrunk to fit its box, so the preview shows exactly what the
 * PDF will look like, line breaks included.
 */
export function CvPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [inner, setInner] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.5);
  const [height, setHeight] = useState(0);

  // Measured before the first paint, so the page never shows at zero height.
  useLayoutEffect(() => {
    if (!box || !inner) return;
    const update = () => {
      const s = Math.min(1, box.clientWidth / CV_PAGE_WIDTH_PX);
      setScale(s);
      setHeight(inner.offsetHeight * s);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(box);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [box, inner]);

  return (
    <div ref={setBox} className={`w-full ${className}`}>
      <div style={{ height, position: "relative", overflow: "hidden" }}>
        <div
          ref={setInner}
          style={{ width: CV_PAGE_WIDTH_PX, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
