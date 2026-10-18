"use client";

import { useState } from "react";
import { contactAdminInputSchema, type OwnerTier } from "@iwtr/shared-types";
import { ApiError, apiPost } from "@/lib/api-client";
import { formProblem } from "@/lib/validateForm";
import { useT } from "@/lib/i18n/client";

// What each plan gets (pricing table: "Customer Support & Service Level").
const SUPPORT_BY_TIER: Record<OwnerTier, string> = {
  FREE: "Standard mail",
  STARTER: "Standard mail",
  PRO: "Prioritized mail support (answer within 4 hours)",
  ENTERPRISE: "Prioritized mail support (answer within 4 hours) and chat",
};

/**
 * Customer Support & Service Level (SLA): what support this plan includes,
 * and the one-way message form to our admins.
 */
export function SupportCategory({ companyId, tier }: { companyId: string; tier: OwnerTier }) {
  const [message, setMessage] = useState("");
  const t = useT();
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const priority = tier === "PRO" || tier === "ENTERPRISE";

  async function send() {
    const text = message.trim();
    if (!text) return;
    const problem = formProblem(contactAdminInputSchema, { message: text }, {}, t);
    if (problem) {
      setError(problem);
      return;
    }
    setSending(true);
    setError(null);
    setStatus(null);
    try {
      await apiPost(`/my-companies/${companyId}/contact-admin`, { message: text });
      setMessage("");
      setStatus(t("Message sent to the admin."));
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("Couldn't send the message."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl bg-surface p-7 shadow-xs">
      <h3 className="mb-1 font-semibold text-foreground">{t("Customer Support & Service Level (SLA)")}</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("Your plan includes:")} <span className="font-medium text-foreground">{t(SUPPORT_BY_TIER[tier])}</span>.
      </p>
      <ul className="mb-6 max-w-2xl space-y-1.5 text-sm">
        <li className="text-foreground">{t("Email support - every plan.")}</li>
        <li className={priority ? "text-foreground" : "text-muted-foreground"}>
          {t("Priority email, answered within 4 hours - Pro and Enterprise.")}
        </li>
        <li className={tier === "ENTERPRISE" ? "text-foreground" : "text-muted-foreground"}>
          {t("Live chat - Enterprise only.")}
        </li>
      </ul>

      <label className="block max-w-3xl text-xs font-medium text-muted-foreground">
        {t("Contact the admin (one-way: they can't reply here, but can reach you by email)")}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder={t("e.g. our details are wrong, or we have a question")}
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
      </label>
      <button
        type="button"
        onClick={send}
        disabled={sending || !message.trim()}
        className="mt-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {t("Send message")}
      </button>
      {status && <p className="mt-3 text-sm text-green-700 dark:text-green-400">{status}</p>}
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}
