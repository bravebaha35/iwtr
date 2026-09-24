"use client";

import { useState } from "react";
import { apiPost, ApiError } from "@/lib/api-client";
import { DateDropdownPicker } from "@/components/DateDropdownPicker";
import { LocationPicker, type LocationValue } from "@/components/LocationPicker";

export function PiiForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationValue>({ country: null, city: null, district: null });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!birthDate || !location.country || !location.city) {
      setError("Please fill in your birth date, country, and city.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await apiPost("/onboarding/pii", {
        firstName,
        lastName,
        birthDate,
        country: location.country,
        city: location.city,
        district: location.district ?? undefined,
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl bg-surface p-8 shadow-xl"
      >
        <h2 className="mb-1 text-xl font-bold text-foreground">
          Tell us who you are
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          This information is kept private and encrypted. It is used only to confirm you&apos;re a
          real person and to prevent duplicate accounts &mdash; it is never shown publicly.
        </p>

        <div className="flex flex-col gap-3">
          <div>
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground"
              />
              <input
                required
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Double-check the spelling — your name and surname can&apos;t be changed later except by contacting us.
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">Birth date</p>
            <DateDropdownPicker value={birthDate} onChange={setBirthDate} maxYear={new Date().getFullYear()} />
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">Country, city &amp; district</p>
            <LocationPicker value={location} onChange={setLocation} />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
