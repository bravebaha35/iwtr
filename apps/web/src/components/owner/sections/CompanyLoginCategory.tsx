"use client";

import { useCallback, useEffect, useState } from "react";
import { companyLoginSetupInputSchema, type CompanyLoginView } from "@iwtr/shared-types";
import { apiDelete, apiGet, apiPost, ApiError } from "@/lib/api-client";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { isPasswordValid, PASSWORD_MAX_LENGTH } from "@/lib/passwordValidation";

/**
 * Owner dashboard > Company Login: one shared email + password for the
 * company that the owner hands to their team. Signing in with it opens only
 * this company's dashboard (job postings, applications, replies, messages,
 * reports) - never the owner's own profile, CV, reviews or ID details.
 * Changing the password or removing the login signs everyone out of it.
 */
export function CompanyLoginCategory({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [current, setCurrent] = useState<CompanyLoginView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const path = `/my-companies/${companyId}/company-login`;

  const load = useCallback(async () => {
    try {
      const view = await apiGet<CompanyLoginView>(path);
      setCurrent(view);
      setEmail(view.email ?? "");
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load the company login.");
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  const passwordsMatch = confirm.length > 0 && password === confirm;
  const canSave = !saving && email.trim().length > 0 && isPasswordValid(password) && passwordsMatch;

  async function save() {
    setError(null);
    setNotice(null);
    const parsed = companyLoginSetupInputSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError("Enter a valid email address and a strong password.");
      return;
    }
    setSaving(true);
    try {
      const view = await apiPost<CompanyLoginView>(path, parsed.data);
      setCurrent(view);
      setEditing(false);
      setPassword("");
      setConfirm("");
      setNotice(
        current?.email
          ? "Saved. Anyone signed in with the old password has been signed out."
          : "Company login created. Share the email and password with your team.",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the company login.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remove the company login? Everyone signed in with it will be signed out.")) return;
    setError(null);
    setNotice(null);
    try {
      setCurrent(await apiDelete<CompanyLoginView>(path));
      setEmail("");
      setEditing(false);
      setNotice("Company login removed. Everyone using it has been signed out.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove the company login.");
    }
  }

  const inputClass = "w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground";

  return (
    <div className="rounded-2xl bg-surface p-7 shadow-xs">
      <h3 className="mb-1 font-semibold text-foreground">Company Login</h3>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        One shared login for {companyName} that you can give to your team. It opens only this company&apos;s dashboard -
        job postings, applications, replies to reviews, messages and reports. It never opens your own profile, CV,
        reviews or ID details. People sign in with it from the normal Log in screen, by ticking &quot;Company
        login&quot;.
      </p>

      {loadError && <p className="mb-3 text-sm text-red-600 dark:text-red-300">{loadError}</p>}
      {current === null && !loadError && <p className="text-sm text-muted-foreground">Loading...</p>}

      {current !== null && !editing && (
        <div className="flex flex-wrap items-center gap-3">
          {current.email ? (
            <p className="text-sm text-foreground">
              Login email: <span className="font-semibold">{current.email}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">This company has no shared login yet.</p>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setNotice(null);
            }}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            {current.email ? "Change email or password" : "Create company login"}
          </button>
          {current.email && (
            <button
              type="button"
              onClick={() => void remove()}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              Remove
            </button>
          )}
        </div>
      )}

      {editing && (
        <div className="flex max-w-md flex-col gap-3">
          <label className="text-[13px] font-semibold text-foreground" htmlFor="company-login-email">
            Login email
          </label>
          <input
            id="company-login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. hr@yourcompany.com"
            className={inputClass}
          />
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder={current?.email ? "New password" : "Password"}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
          />
          {password.length > 0 && <PasswordChecklist password={password} />}
          <PasswordInput
            value={confirm}
            onChange={setConfirm}
            placeholder="Confirm password"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
          />
          {confirm.length > 0 && !passwordsMatch && (
            <p className="-mt-1 text-xs text-red-600 dark:text-red-300">Passwords don&apos;t match.</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={!canSave}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setPassword("");
                setConfirm("");
                setEmail(current?.email ?? "");
                setError(null);
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-surface-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
      {notice && <p className="mt-3 text-sm text-green-700 dark:text-green-400">{notice}</p>}
    </div>
  );
}
