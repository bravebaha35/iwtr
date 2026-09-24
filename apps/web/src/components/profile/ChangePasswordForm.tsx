"use client";

import { useState } from "react";
import { apiPatch, ApiError } from "@/lib/api-client";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { PASSWORD_MAX_LENGTH, isPasswordValid } from "@/lib/passwordValidation";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordsMatch = confirmNewPassword.length > 0 && newPassword === confirmNewPassword;
  const canSubmit = currentPassword.length > 0 && isPasswordValid(newPassword) && passwordsMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      await apiPatch("/me/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setStatus("Password changed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change your password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-1 font-semibold text-foreground">Change password</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Enter your current password, then choose a new one.
      </p>

      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Current password</p>
          <PasswordInput value={currentPassword} onChange={setCurrentPassword} placeholder="Current password" autoComplete="current-password" />
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">New password</p>
          <PasswordInput
            value={newPassword}
            onChange={setNewPassword}
            placeholder="New password"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
          />
        </div>

        {newPassword.length > 0 && <PasswordChecklist password={newPassword} />}

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">New password again</p>
          <PasswordInput
            value={confirmNewPassword}
            onChange={setConfirmNewPassword}
            placeholder="New password again"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
          />
          {confirmNewPassword.length > 0 && !passwordsMatch && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">Passwords don&apos;t match.</p>
          )}
        </div>
      </div>

      {status && <p className="mt-3 text-sm text-green-700 dark:text-green-400">{status}</p>}
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !canSubmit}
        className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Change password"}
      </button>
    </form>
  );
}
