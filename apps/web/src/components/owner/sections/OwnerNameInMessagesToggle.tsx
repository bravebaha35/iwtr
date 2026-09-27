"use client";

import { useEffect, useState } from "react";
import type { OwnerMessagingName } from "@iwtr/shared-types";
import { ApiError, apiGet, apiPatch } from "@/lib/api-client";

/**
 * "Show company owner's name during messaging" - the tick-box under
 * Contact & Social Media. Off by default: reviewers this owner messages see
 * "Company representative" until it's ticked. One setting per owner per
 * company, saved the moment it's clicked.
 */
export function OwnerNameInMessagesToggle({ companyId }: { companyId: string }) {
  const [setting, setSetting] = useState<OwnerMessagingName | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<OwnerMessagingName>(`/my-companies/${companyId}/messaging-name`)
      .then((s) => {
        if (!cancelled && s) setSetting(s);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this setting.");
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  async function toggle(show: boolean) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      setSetting(await apiPatch<OwnerMessagingName>(`/my-companies/${companyId}/messaging-name`, { showNameInMessages: show }));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this setting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={setting?.showNameInMessages ?? false}
          disabled={setting === null || saving}
          onChange={(e) => void toggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">Show company owner&apos;s name during messaging.</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {setting?.ownerName
              ? `Reviewers you message will see "${setting.ownerName}". When unticked they see "Company representative". Saves as soon as you click it.`
              : `Reviewers see "Company representative". To show your name, first add your first and last name in Edit Profile.`}
          </span>
        </span>
      </label>
      {saved && <p className="mt-2 text-xs text-green-700 dark:text-green-400">Setting saved.</p>}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}
