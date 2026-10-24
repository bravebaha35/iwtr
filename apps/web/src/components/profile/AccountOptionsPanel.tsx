"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiPost, apiDelete } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/core";
import { EmailConfirmGate } from "@/components/profile/EmailConfirmGate";

type PendingAction = "freeze" | "delete" | null;

// Each language is written in its own name, so it can be found whichever
// one the page is in now.
const LANGUAGE_CHOICES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "tr", label: "Türkçe" },
];

// The site's language for this browser (a cookie, like the theme), applied
// the moment one is picked. Plain words with an underline, the same as the
// sort words beside the search field: thin at rest, thick Wood when picked.
function LanguagePanel() {
  const { locale, setLocale, switching, t } = useI18n();
  return (
    <div className="rounded-2xl bg-surface shadow-xs p-5">
      <h2 className="mb-1 font-semibold text-foreground">{t("Language")}</h2>
      <p className="mb-2 text-sm text-muted-foreground">{t("Choose your language.")}</p>
      <div role="radiogroup" aria-label={t("Language")} className="-ml-3 flex flex-wrap items-center">
        {LANGUAGE_CHOICES.map((choice) => {
          const selected = locale === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={switching}
              onClick={() => !selected && setLocale(choice.value)}
              lang={choice.value}
              className={`flex h-10 items-center px-3 text-sm font-semibold underline underline-offset-[6px] transition-[color,text-decoration-color] disabled:opacity-60 ${
                selected
                  ? "cursor-default text-brand-700 decoration-2 decoration-brand-600 dark:text-brand-300 dark:decoration-brand-400"
                  : "text-muted-foreground decoration-1 decoration-muted-foreground/40 hover:text-foreground hover:decoration-foreground/60"
              }`}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Freezing or deleting only ever actually happens once the visitor confirms
// through EmailConfirmGate — clicking the button just picks which action
// the confirm step will perform, per "only apply the given options when
// they verify their mail".
export function AccountOptionsPanel({ email }: { email: string | null }) {
  const { logout } = useAuth();
  const { t } = useI18n();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  async function confirmFreeze() {
    await apiPost("/me/freeze", {});
    logout();
  }

  async function confirmDelete() {
    await apiDelete("/me");
    logout();
  }

  if (pendingAction && email) {
    return (
      <div className="rounded-2xl bg-surface shadow-xs p-5">
        <EmailConfirmGate
          email={email}
          actionLabel={pendingAction === "freeze" ? t("freeze your account") : t("permanently delete your account")}
          onConfirmed={pendingAction === "freeze" ? confirmFreeze : confirmDelete}
          onCancel={() => setPendingAction(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <LanguagePanel />

      <div className="rounded-2xl bg-surface shadow-xs p-5">
        <h2 className="mb-1 font-semibold text-foreground">{t("Freeze account")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {t("Your information will not be lost. You can reactivate your account at any time.")}
        </p>
        <button
          type="button"
          onClick={() => setPendingAction("freeze")}
          disabled={!email}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-muted disabled:opacity-50"
        >
          {t("Freeze account")}
        </button>
      </div>

      <div className="rounded-xl border border-red-300 bg-surface p-5 dark:border-red-800">
        <h2 className="mb-1 font-semibold text-foreground">{t("Delete account")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {t("If you delete your account, all your information will be deleted and your current reviews will be lost.")}
        </p>
        <button
          type="button"
          onClick={() => setPendingAction("delete")}
          disabled={!email}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {t("Delete account")}
        </button>
      </div>
    </div>
  );
}
