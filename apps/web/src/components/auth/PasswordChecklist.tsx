"use client";

import {
  CATEGORY_REQUIREMENTS,
  LENGTH_REQUIREMENT,
  MIN_CATEGORY_MATCHES,
  passwordCategoryCount,
} from "@/lib/passwordValidation";

function ChecklistRow({ label, met }: { label: string; met: boolean }) {
  return (
    <li className={`flex items-center gap-1.5 ${met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
      <span
        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          met ? "border-green-600 bg-green-600 dark:border-green-400 dark:bg-green-400" : "border-border"
        }`}
      >
        {met && (
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-white dark:text-surface" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      {label}
    </li>
  );
}

// Shared by the register form (AuthModal) and the change-password form
// (Security tab) — same rules, same look, one place to keep them in sync.
// Hidden until the password field has something typed (see both call sites).
export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="-mt-1 flex flex-col gap-1 rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-xs">
      <ChecklistRow label={LENGTH_REQUIREMENT.label} met={LENGTH_REQUIREMENT.met(password)} />
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Include at least {MIN_CATEGORY_MATCHES} of the following {CATEGORY_REQUIREMENTS.length}
        {passwordCategoryCount(password) >= MIN_CATEGORY_MATCHES ? " — done" : ""}:
      </p>
      {CATEGORY_REQUIREMENTS.map((req) => (
        <ChecklistRow key={req.id} label={req.label} met={req.met(password)} />
      ))}
    </ul>
  );
}
