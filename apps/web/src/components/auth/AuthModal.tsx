"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { Logo } from "@/components/Logo";

export function AuthModal() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "register") {
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl dark:bg-zinc-900">
        <div className="mb-1 flex items-center justify-center gap-2">
          <Logo />
          <h2 className="text-center text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            I Worked There
          </h2>
        </div>
        <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Anonymous, honest workplace reviews.
        </p>

        <div className="mb-6 flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === "register"
                ? "bg-white text-brand-700 shadow dark:bg-zinc-700 dark:text-brand-400"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
            onClick={() => setMode("register")}
          >
            Register
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === "login"
                ? "bg-white text-brand-700 shadow dark:bg-zinc-700 dark:text-brand-400"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
            onClick={() => setMode("login")}
          >
            Log in
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? "Please wait..." : mode === "register" ? "Create account" : "Log in"}
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded-lg border border-zinc-300 py-2 text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-600"
          >
            Continue with Google (coming soon)
          </button>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded-lg border border-zinc-300 py-2 text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-600"
          >
            Continue with Apple (coming soon)
          </button>
        </div>
      </div>
    </div>
  );
}
