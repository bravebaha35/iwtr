"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiPost, apiDelete } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/core";
import { EmailConfirmGate } from "@/components/profile/EmailConfirmGate";

type PendingAction = "freeze" | "delete" | null;

const LANGUAGE_CHOICES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "tr", label: "Turkish" },
];

// The site's language for this browser (a cookie, like the theme), applied
// the moment one is picked. The picked one is the Wood "selected" fill.
function LanguagePanel() {
  const { locale, setLocale, switching, t } = useI18n();
  return (
    <div className="rounded-2xl bg-surface shadow-xs p-5">
      <h2 className="mb-1 font-semibold text-foreground">{t("Language")}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("Choose your language.")}</p>
      <div role="radiogroup" aria-label={t("Language")} className="flex flex-wrap gap-2">
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
              className={`min-w-28 rounded-full px-5 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 ${
                selected ? "bg-brand-600 text-white" : "bg-surface-muted text-foreground hover:bg-border/70"
              }`}
            >
              {t(choice.label)}
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
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  async function confirmFreeze() {
    await apiPost("/me/freeze", {});
    logout();
    router.push("/");
  }

  async function confirmDelete() {
    await apiDelete("/me");
    logout();
    router.push("/");
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
