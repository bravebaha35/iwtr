"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiPost, apiDelete } from "@/lib/api-client";
import { EmailConfirmGate } from "@/components/profile/EmailConfirmGate";

type PendingAction = "freeze" | "delete" | null;

// Freezing or deleting only ever actually happens once the visitor confirms
// through EmailConfirmGate — clicking the button just picks which action
// the confirm step will perform, per "only apply the given options when
// they verify their mail".
export function AccountOptionsPanel({ email }: { email: string | null }) {
  const { logout } = useAuth();
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
      <div className="rounded-xl border border-border bg-surface p-5">
        <EmailConfirmGate
          email={email}
          actionLabel={pendingAction === "freeze" ? "freeze your account" : "permanently delete your account"}
          onConfirmed={pendingAction === "freeze" ? confirmFreeze : confirmDelete}
          onCancel={() => setPendingAction(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-1 font-semibold text-foreground">Freeze account</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Your information will not be lost. You can reactivate your account at any time.
        </p>
        <button
          type="button"
          onClick={() => setPendingAction("freeze")}
          disabled={!email}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-muted disabled:opacity-50"
        >
          Freeze account
        </button>
      </div>

      <div className="rounded-xl border border-red-300 bg-surface p-5 dark:border-red-800">
        <h2 className="mb-1 font-semibold text-foreground">Delete account</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          If you delete your account, all your information will be deleted and your current reviews will be lost.
        </p>
        <button
          type="button"
          onClick={() => setPendingAction("delete")}
          disabled={!email}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          Delete account
        </button>
      </div>
    </div>
  );
}
