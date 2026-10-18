"use client";

import { useState } from "react";
import {
  MAX_REFERENCES_PER_MEMBER,
  referenceInputSchema,
  type JobPosition,
  type MemberReference,
  type ReferenceInput,
} from "@iwtr/shared-types";
import { apiDelete, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { formProblem } from "@/lib/validateForm";
import { JOB_POSITIONS, jobPositionLabel } from "@/lib/jobPositions";
import { SingleSelectDropdown } from "@/components/Dropdown";
import { PhoneNumberInput } from "@/components/PhoneNumberInput";
import { useT } from "@/lib/i18n/client";

const FIELD_LABELS = {
  firstName: "first name",
  lastName: "last name",
  position: "position",
  email: "email address",
  phoneNumber: "phone number",
};

type Draft = { firstName: string; lastName: string; position: JobPosition | null; email: string; phoneNumber: string };

const EMPTY: Draft = { firstName: "", lastName: "", position: null, email: "", phoneNumber: "+90" };

// PhoneNumberInput keeps the country code even when no number is typed.
function phoneOrEmpty(value: string): string {
  return /^\+\d{1,4}$/.test(value.trim()) ? "" : value.trim();
}

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80";

/**
 * Edit Profile > References: people from the member's past jobs an employer
 * can contact. Printed on the CV the member sends when applying.
 */
export function ReferencesPanel({
  references,
  onChange,
}: {
  references: MemberReference[];
  onChange: (next: MemberReference[]) => void;
}) {
  const t = useT();
  // null: no form open. "new": adding. Otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const atLimit = references.length >= MAX_REFERENCES_PER_MEMBER;

  function open(target: MemberReference | null) {
    setError(null);
    if (target) {
      setEditing(target.id);
      setDraft({
        firstName: target.firstName,
        lastName: target.lastName,
        position: target.position,
        email: target.email ?? "",
        phoneNumber: target.phoneNumber ?? "+90",
      });
    } else {
      setEditing("new");
      setDraft(EMPTY);
    }
  }

  async function save() {
    const body = {
      firstName: draft.firstName,
      lastName: draft.lastName,
      position: draft.position,
      email: draft.email.trim(),
      phoneNumber: phoneOrEmpty(draft.phoneNumber),
    };
    const problem = formProblem(referenceInputSchema, body, FIELD_LABELS, t);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing === "new") {
        const created = await apiPost<MemberReference>("/me/references", body as ReferenceInput);
        onChange([...references, created]);
      } else if (editing) {
        const updated = await apiPatch<MemberReference>(`/me/references/${editing}`, body as ReferenceInput);
        onChange(references.map((r) => (r.id === updated.id ? updated : r)));
      }
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
      await apiDelete(`/me/references/${id}`);
      onChange(references.filter((r) => r.id !== id));
      if (editing === id) setEditing(null);
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("Couldn't remove that."));
    }
  }

  const form = (
    <div className="flex flex-col gap-4 rounded-xl bg-surface-muted/60 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">{t("First name")}</span>
          <input
            value={draft.firstName}
            maxLength={60}
            onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
            className={INPUT}
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">{t("Last name")}</span>
          <input
            value={draft.lastName}
            maxLength={60}
            onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
            className={INPUT}
            autoComplete="off"
          />
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-foreground">{t("Position at the company")}</span>
        <SingleSelectDropdown
          value={draft.position}
          onChange={(v) => setDraft({ ...draft, position: (v as JobPosition | null) ?? null })}
          options={JOB_POSITIONS.map((p) => ({ value: p.value, label: t(p.label) }))}
          placeholder={t("Pick their position")}
          ariaLabel={t("Position at the company")}
          searchable={false}
          maxHeightClassName="max-h-72"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">{t("Email address")}</span>
          <input
            type="email"
            value={draft.email}
            maxLength={254}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            placeholder={t("name.surname@gmail.com")}
            className={INPUT}
            autoComplete="off"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">{t("Phone number")}</span>
          <PhoneNumberInput value={draft.phoneNumber} onChange={(v) => setDraft({ ...draft, phoneNumber: v })} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("Add at least an email address or a phone number. Ask your reference first: their details are printed on the CV you send to employers.")}
      </p>
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
    <div className="rounded-2xl bg-surface p-5 shadow-xs">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-foreground">{t("References")}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {references.length} / {MAX_REFERENCES_PER_MEMBER}
        </span>
      </div>
      <p className="mb-5 text-xs text-muted-foreground">
        {t("People from your past jobs who can speak for your work. They appear on your CV, nowhere else on the site.")}
      </p>

      {references.length === 0 && editing !== "new" && (
        <p className="mb-4 text-sm text-muted-foreground">{t("No references yet.")}</p>
      )}

      <ul className="mb-4 flex flex-col gap-3">
        {references.map((r) =>
          editing === r.id ? (
            <li key={r.id}>{form}</li>
          ) : (
            <li key={r.id} className="flex items-start justify-between gap-4 rounded-xl bg-surface-muted/60 px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  {r.firstName} {r.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{t(jobPositionLabel(r.position))}</p>
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  {[r.email, r.phoneNumber].filter(Boolean).join("   ")}
                </p>
              </div>
              <span className="flex shrink-0 gap-3 text-xs">
                <button type="button" onClick={() => open(r)} className="text-brand-600 hover:underline dark:text-brand-400">
                  {t("Edit")}
                </button>
                <button type="button" onClick={() => void remove(r.id)} className="text-red-600 hover:underline dark:text-red-300">
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
          + {t("Add reference")}
        </button>
      )}
      {error && editing === null && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}
