"use client";

import { useEffect, useState } from "react";
import type { Company, MemberIdentityMode, PublicSocialQuestion, WorkplaceType } from "@iwtr/shared-types";
import { SOCIAL_QUESTION_MAX, SOCIAL_QUESTION_MIN } from "@iwtr/shared-types";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { WorkTypeTiles } from "@/components/WorkTypeTiles";
import { QuestionIdentityPicker, useQuestionIdentity } from "./QuestionIdentityPicker";

type PickedCompany = { id: string; name: string; mainPhotoUrl?: string | null };
type AskTarget = "company" | "workType";

// Type a company's name, pick it from the list. Once picked it shows as a
// chip with a way to change it.
function CompanyPicker({ value, onChange }: { value: PickedCompany | null; onChange: (next: PickedCompany | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Company[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setFailed(false);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      apiGet<Company[]>(`/companies?q=${encodeURIComponent(q)}`)
        .then((rows) => {
          if (cancelled) return;
          setResults(rows.slice(0, 6));
          setFailed(false);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-surface-muted/70 p-2">
        <CompanyLogo name={value.name} mainPhotoUrl={value.mainPhotoUrl ?? null} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{value.name}</span>
        <button type="button" onClick={() => onChange(null)} className="shrink-0 px-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="ask-company" className="sr-only">
        Company to ask
      </label>
      <input
        id="ask-company"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Type the company's name..."
        autoComplete="off"
        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
      />
      {failed && <p className="text-xs text-red-600 dark:text-red-300">Couldn&apos;t search right now. Try again.</p>}
      {!failed && query.trim() && results.length === 0 && <p className="text-xs text-muted-foreground">No company by that name yet.</p>}
      {results.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onChange({ id: c.id, name: c.name, mainPhotoUrl: c.mainPhotoUrl })}
                className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-muted"
              >
                <CompanyLogo name={c.name} mainPhotoUrl={c.mainPhotoUrl} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.category}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Where a member asks a question. It rests as one quiet line; opened, it
 * asks who the question is for (one company, or everyone in a kind of work),
 * the question itself, and which anonymous name to ask under. On a company's
 * own Social tab the company is already settled (`company`).
 */
export function AskQuestionBox({ company, onAsked }: { company?: PickedCompany; onAsked: (question: PublicSocialQuestion) => void }) {
  const identity = useQuestionIdentity(true);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<AskTarget>("company");
  const [picked, setPicked] = useState<PickedCompany | null>(null);
  const [workType, setWorkType] = useState<WorkplaceType | null>(null);
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<MemberIdentityMode>("PERSONAL_CHOSEN");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const asked = company ?? picked;
  const hasTarget = company ? true : target === "company" ? picked !== null : workType !== null;
  const length = body.trim().length;
  const ready = hasTarget && length >= SOCIAL_QUESTION_MIN;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left shadow-xs transition hover:bg-surface-muted/50 active:scale-[0.995]"
      >
        <Avatar avatarKey={identity?.avatarKey ?? null} avatarGradient={identity?.avatarGradient ?? null} size="sm" />
        <span className="min-w-0 flex-1 truncate text-[15px] text-muted-foreground">
          {company ? `Ask people who worked at ${company.name}...` : "Ask people who worked there..."}
        </span>
        <span className="shrink-0 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white">Ask</span>
      </button>
    );
  }

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const created = await apiPost<PublicSocialQuestion>("/social/questions", {
        ...(asked && (company || target === "company") ? { companyId: asked.id } : { workType }),
        body: body.trim(),
        identityMode: mode,
      });
      onAsked(created);
      setBody("");
      setPicked(null);
      setWorkType(null);
      setOpen(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't post that question.");
    } finally {
      setBusy(false);
    }
  }

  const targetTab = (value: AskTarget, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={target === value}
      onClick={() => setTarget(value)}
      className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition active:scale-[0.98] ${
        target === value ? "bg-brand-600 text-white" : "bg-surface-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section aria-label="Ask a question" className="flex flex-col gap-4 rounded-2xl bg-surface p-4 shadow-xs">
      {!company && (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-1 text-[13px] font-semibold text-foreground">Who are you asking?</h2>
            <div role="radiogroup" aria-label="Who are you asking?" className="flex gap-1.5">
              {targetTab("company", "A company")}
              {targetTab("workType", "A kind of work")}
            </div>
          </div>
          {target === "company" ? (
            <CompanyPicker value={picked} onChange={setPicked} />
          ) : (
            <WorkTypeTiles selected={workType ? [workType] : []} onToggle={(v) => setWorkType(workType === v ? null : v)} columns={4} />
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="ask-body" className="text-[13px] font-semibold text-foreground">
          Your question
        </label>
        <textarea
          id="ask-body"
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, SOCIAL_QUESTION_MAX))}
          rows={3}
          autoFocus={Boolean(company)}
          maxLength={SOCIAL_QUESTION_MAX}
          placeholder={company ? `What would you like to know about working at ${company.name}?` : "What would you like to know?"}
          className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 text-[15px] leading-relaxed text-foreground"
        />
        <p className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
          <span>Asked anonymously. Leave out people&apos;s names and phone numbers.</span>
          <span className="shrink-0 tabular-nums">
            {body.length}/{SOCIAL_QUESTION_MAX}
          </span>
        </p>
      </div>

      <QuestionIdentityPicker value={mode} onChange={setMode} identity={identity} verb="Ask" />

      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!ready || busy}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Posting..." : "Ask question"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
        {!ready && length > 0 && length < SOCIAL_QUESTION_MIN && (
          <span className="text-xs text-muted-foreground">A little longer, so people can answer.</span>
        )}
      </div>
    </section>
  );
}
