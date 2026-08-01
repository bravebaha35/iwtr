"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Company } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api-client";
import { avatarEmoji } from "@/lib/avatars";
import { AuthModal } from "@/components/auth/AuthModal";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { CompanySearch } from "@/components/CompanySearch";

function BrowseCompanies() {
  const [companies, setCompanies] = useState<Company[] | null>(null);

  useEffect(() => {
    apiGet<Company[]>("/companies")
      .then((data) => setCompanies(data.slice(0, 8)))
      .catch(() => setCompanies([]));
  }, []);

  if (companies === null || companies.length === 0) return null;

  return (
    <div className="mt-12 w-full max-w-3xl">
      <h3 className="mb-3 text-left text-sm font-semibold text-zinc-500 dark:text-zinc-400">
        Browse companies
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {companies.map((c) => (
          <Link
            key={c.id}
            href={`/companies/${c.slug}`}
            className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-center transition hover:border-brand-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-700"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-lg font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
              {c.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{c.name}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{c.category}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { isLoading, accessToken, role, onboardingStatus, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="relative min-h-screen bg-zinc-50 dark:bg-black">
        <AuthModal />
      </div>
    );
  }

  // A fresh login/register has a token but hasn't finished the onboarding-status
  // fetch yet (persistTokens sets the token synchronously, then awaits the
  // status call) — treat "not loaded yet" as still loading, not as ACTIVE,
  // so a brand-new PENDING_PII account can't flash into the authenticated shell.
  if (!onboardingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (onboardingStatus.status !== "ACTIVE") {
    return (
      <div className="relative min-h-screen bg-zinc-50 dark:bg-black">
        <OnboardingFlow />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
            IWT
          </span>
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">I Worked There</span>
        </Link>
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/my/companies" className="hover:text-brand-600 dark:hover:text-brand-400">
              My Companies
            </Link>
            {role === "ADMIN" && (
              <>
                <Link href="/admin/moderation" className="hover:text-brand-600 dark:hover:text-brand-400">
                  Moderation Queue
                </Link>
                <Link href="/admin/owner-claims" className="hover:text-brand-600 dark:hover:text-brand-400">
                  Owner Claims
                </Link>
              </>
            )}
          </nav>
          <CompanySearch />
          <button
            onClick={logout}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center px-6 py-16 text-center">
        <p className="text-3xl">{avatarEmoji(onboardingStatus?.avatarKey) ?? "👋"}</p>
        <h2 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Know before you go.
        </h2>
        <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          Real, anonymous reviews from people who actually worked there.
        </p>

        <div className="mt-8 w-full max-w-xl">
          <CompanySearch size="lg" />
        </div>

        <BrowseCompanies />
      </main>
    </div>
  );
}
