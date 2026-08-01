"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiPost, ApiError } from "@/lib/api-client";
import type { PiiOnboardingInput } from "@iwtr/shared-types";

const initial: PiiOnboardingInput = {
  firstName: "",
  lastName: "",
  tcKimlikNo: "",
  birthDate: "",
  city: "",
  district: "",
  phoneNumber: "",
};

export function PiiForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { accessToken } = useAuth();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof PiiOnboardingInput>(key: K, value: PiiOnboardingInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiPost("/onboarding/pii", form, accessToken ?? undefined);
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
        className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl dark:bg-zinc-900"
      >
        <h2 className="mb-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Tell us who you are
        </h2>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          This information is kept private and encrypted. It is used only to confirm you&apos;re a
          real person and to prevent duplicate accounts &mdash; it is never shown publicly.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <input
            required
            placeholder="First name"
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            className="col-span-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <input
            required
            placeholder="Last name"
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            className="col-span-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <input
            required
            placeholder="T.C. Kimlik No (11 digits)"
            pattern="[0-9]{11}"
            title="Must be 11 digits"
            value={form.tcKimlikNo}
            onChange={(e) => set("tcKimlikNo", e.target.value)}
            className="col-span-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <label className="col-span-2 flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            Birth date
            <input
              required
              type="date"
              value={form.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </label>
          <input
            required
            placeholder="City"
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            className="col-span-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <input
            required
            placeholder="District"
            value={form.district}
            onChange={(e) => set("district", e.target.value)}
            className="col-span-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <input
            required
            placeholder="Phone number"
            value={form.phoneNumber}
            onChange={(e) => set("phoneNumber", e.target.value)}
            className="col-span-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
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
