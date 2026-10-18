"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  CERTIFICATE_CATALOG,
  CERTIFICATE_DESCRIPTION_MAX_LENGTH,
  MAX_CERTIFICATES_PER_MEMBER,
  certificateInputSchema,
  type CertificateCatalogEntry,
  type MemberCertificate,
} from "@iwtr/shared-types";
import { apiDelete, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { formProblem } from "@/lib/validateForm";
import { SingleSelectDropdown } from "@/components/Dropdown";
import { RichTextEditor } from "@/components/RichTextEditor";
import { RichText } from "@/components/RichText";
import { useI18n } from "@/lib/i18n/client";
import { intlLocale, type Locale } from "@/lib/i18n/core";

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80";

const FIELD_LABELS = { name: "certificate name", issuer: "issuing organisation", issuedMonth: "certificate date" };

// Case and accent blind, Turkish-aware: "is guvenligi" finds "İş Güvenliği".
function fold(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const SEARCH_INDEX = CERTIFICATE_CATALOG.map((entry) => ({ entry, key: fold(`${entry.name} ${entry.issuer}`) }));

function searchCatalog(query: string): CertificateCatalogEntry[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return CERTIFICATE_CATALOG.slice(0, 40);
  const typed = words.join(" ");
  // Names that start with what was typed come first.
  return SEARCH_INDEX.filter(({ key }) => words.every((w) => key.includes(w)))
    .map(({ entry, key }) => ({ entry, rank: key.startsWith(typed) ? 0 : 1 }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 40)
    .map(({ entry }) => entry);
}

export function formatIssuedMonth(month: string, locale: Locale): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(intlLocale(locale), {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The certificate's name: type to search the catalog, or keep what you
 * typed when it isn't listed. Picking a listed one also fills in who issues
 * it (when that box is still empty).
 */
function CertificateNameInput({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (next: string) => void;
  onPick: (entry: CertificateCatalogEntry) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listId = useId();
  const blurTimer = useRef<number | null>(null);
  const results = useMemo(() => searchCatalog(value), [value]);

  function pick(entry: CertificateCatalogEntry) {
    onPick(entry);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        maxLength={120}
        placeholder={t("e.g. Digital Marketing Certificate")}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(results[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={INPUT}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl bg-surface p-1 shadow-lg ring-1 ring-border"
          onMouseDown={(e) => {
            // Keep focus in the box while a row is clicked.
            e.preventDefault();
            if (blurTimer.current) window.clearTimeout(blurTimer.current);
          }}
        >
          {results.map((entry, i) => (
            <li
              key={entry.name}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pick(entry)}
              className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${i === highlight ? "bg-surface-muted" : ""}`}
            >
              <span className="block text-foreground">{entry.name}</span>
              {entry.issuer && <span className="block text-xs text-muted-foreground">{entry.issuer}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function MonthYearPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { t } = useI18n();
  const [year, month] = value ? value.split("-") : ["", ""];
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 60 }, (_, i) => String(thisYear - i));
  // A half-picked date is kept as "YYYY-" or "-MM" until both are chosen.
  const set = (y: string, m: string) => onChange(`${y}-${m}`);
  return (
    <div className="grid grid-cols-2 gap-2">
      <SingleSelectDropdown
        value={month || null}
        onChange={(m) => set(year, m ?? "")}
        options={MONTH_NAMES.map((name, i) => ({ value: String(i + 1).padStart(2, "0"), label: t(name) }))}
        placeholder={t("Month")}
        ariaLabel={t("Month")}
        searchable={false}
        clearable={false}
      />
      <SingleSelectDropdown
        value={year || null}
        onChange={(y) => set(y ?? "", month)}
        options={years.map((y) => ({ value: y, label: y }))}
        placeholder={t("Year")}
        ariaLabel={t("Year")}
        searchable={false}
        clearable={false}
      />
    </div>
  );
}

type Draft = { name: string; issuer: string; issuedMonth: string; description: string };
const EMPTY: Draft = { name: "", issuer: "", issuedMonth: "", description: "" };

/** Edit Profile > Personal Information > Certificates. Printed on the CV. */
export function CertificatesSection({
  certificates,
  onChange,
}: {
  certificates: MemberCertificate[];
  onChange: (next: MemberCertificate[]) => void;
}) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const atLimit = certificates.length >= MAX_CERTIFICATES_PER_MEMBER;

  function open(target: MemberCertificate | null) {
    setError(null);
    setEditing(target ? target.id : "new");
    setDraft(
      target
        ? { name: target.name, issuer: target.issuer, issuedMonth: target.issuedMonth, description: target.description ?? "" }
        : EMPTY,
    );
  }

  async function save() {
    const problem = formProblem(certificateInputSchema, draft, FIELD_LABELS, t);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved =
        editing === "new"
          ? await apiPost<MemberCertificate>("/me/certificates", draft)
          : await apiPatch<MemberCertificate>(`/me/certificates/${editing}`, draft);
      const rest = certificates.filter((c) => c.id !== saved.id);
      // Newest first, same order as the CV.
      onChange([...rest, saved].sort((a, b) => b.issuedMonth.localeCompare(a.issuedMonth)));
      setEditing(null);
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("Couldn't save that."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await apiDelete(`/me/certificates/${id}`);
      onChange(certificates.filter((c) => c.id !== id));
      if (editing === id) setEditing(null);
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("Couldn't remove that."));
    }
  }

  const form = (
    <div className="flex flex-col gap-4 rounded-xl bg-surface-muted/60 p-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-foreground">{t("Certificate name")}</span>
        <CertificateNameInput
          value={draft.name}
          onChange={(name) => setDraft((d) => ({ ...d, name }))}
          onPick={(entry) => setDraft((d) => ({ ...d, name: entry.name, issuer: d.issuer.trim() ? d.issuer : entry.issuer }))}
        />
        <span className="text-[11px] text-muted-foreground">{t("Pick one from the list, or type yours if it isn't there.")}</span>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-foreground">{t("Issuing organisation")}</span>
        <input
          value={draft.issuer}
          maxLength={120}
          onChange={(e) => setDraft({ ...draft, issuer: e.target.value })}
          placeholder={t("e.g. Istanbul University")}
          className={INPUT}
          autoComplete="off"
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-foreground">{t("Certificate date")}</span>
        <div className="max-w-xs">
          <MonthYearPicker value={draft.issuedMonth} onChange={(issuedMonth) => setDraft({ ...draft, issuedMonth })} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-foreground">
          {t("Description")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
        </span>
        <RichTextEditor
          value={draft.description}
          onChange={(description) => setDraft((d) => ({ ...d, description }))}
          maxLength={CERTIFICATE_DESCRIPTION_MAX_LENGTH}
          placeholder={t("Share the details of your certificates and qualifications here.")}
          ariaLabel={t("Description")}
          inlineStyles={false}
          className="h-36"
        />
        <span className="self-end text-[11px] tabular-nums text-muted-foreground">
          {draft.description.length} / {CERTIFICATE_DESCRIPTION_MAX_LENGTH}
        </span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? t("Saving...") : t("Save")}
        </button>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted"
        >
          {t("Cancel")}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{t("Certificates")}</p>
        <span className="text-xs tabular-nums text-muted-foreground">
          {certificates.length} / {MAX_CERTIFICATES_PER_MEMBER}
        </span>
      </div>
      {certificates.length === 0 && editing !== "new" && (
        <p className="mb-3 text-xs text-muted-foreground">{t("None added yet.")}</p>
      )}
      <ul className="mb-3 flex flex-col gap-2">
        {certificates.map((c) =>
          editing === c.id ? (
            <li key={c.id}>{form}</li>
          ) : (
            <li key={c.id} className="flex items-start justify-between gap-4 rounded-xl bg-surface-muted/60 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.issuer} <span aria-hidden="true">·</span> {formatIssuedMonth(c.issuedMonth, locale)}
                </p>
                {c.description && (
                  <RichText text={c.description} as="p" className="mt-1.5 line-clamp-3 whitespace-pre-line text-xs text-muted-foreground" />
                )}
              </div>
              <span className="flex shrink-0 gap-3 text-xs">
                <button type="button" onClick={() => open(c)} className="text-brand-600 hover:underline dark:text-brand-400">
                  {t("Edit")}
                </button>
                <button type="button" onClick={() => void remove(c.id)} className="text-red-600 hover:underline dark:text-red-300">
                  {t("Remove")}
                </button>
              </span>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? (
        form
      ) : (
        <button
          type="button"
          onClick={() => open(null)}
          disabled={atLimit || editing !== null}
          className="rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-brand-600 hover:text-white disabled:opacity-50 disabled:hover:bg-surface-muted disabled:hover:text-foreground"
        >
          + {t("Add certificate")}
        </button>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{t("Saved one by one, and shown on your CV.")}</p>
      {error && editing === null && <p className="mt-1 text-sm text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}
