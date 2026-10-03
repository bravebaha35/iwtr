"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ownerNameSchema, type EmployerProfileView } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch, ApiError } from "@/lib/api-client";

/**
 * Every company owner gives their legal name. New owners give it while
 * claiming; an owner from before that rule who never filled it in sees only
 * this form on their dashboard until they do. (Whether reviewers see it is
 * a separate choice - the tick-box under Contact & Social Media.)
 */
export function OwnerNameGate({ children }: { children: ReactNode }) {
  const { refreshOnboardingStatus } = useAuth();
  const [hasName, setHasName] = useState<boolean | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<EmployerProfileView>("/me/employer-profile")
      .then((p) => {
        if (!cancelled) setHasName(Boolean(p.firstName && p.lastName));
      })
      // Never lock an owner out of their dashboard over a failed check.
      .catch(() => {
        if (!cancelled) setHasName(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (!ownerNameSchema.safeParse(firstName).success || !ownerNameSchema.safeParse(lastName).success) {
      setError("Enter your real first and last name (letters only).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiPatch<EmployerProfileView>("/me/employer-profile", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      await refreshOnboardingStatus();
      setHasName(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your name.");
    } finally {
      setSaving(false);
    }
  }

  if (hasName === null) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (hasName) return <>{children}</>;

  const inputClass = "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground";
  return (
    <div className="max-w-xl rounded-xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold text-foreground">Add your name to continue</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Every company owner on I Worked There gives their legal name. Reviewers only see it if you choose to show it
        (under Contact &amp; Social Media); otherwise you answer as &ldquo;Company representative&rdquo;.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          aria-label="First name"
          autoComplete="given-name"
          maxLength={60}
          className={inputClass}
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          aria-label="Last name"
          autoComplete="family-name"
          maxLength={60}
          className={inputClass}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="mt-3 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        Save and continue
      </button>
    </div>
  );
}
