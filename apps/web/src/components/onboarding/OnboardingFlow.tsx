"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { PhoneVerificationForm } from "./PhoneVerificationForm";
import { PiiForm } from "./PiiForm";
import { AnonymityModal } from "./AnonymityModal";
import { HistoryForm } from "./HistoryForm";
import { AvatarPicker } from "./AvatarPicker";

export function OnboardingFlow() {
  const { onboardingStatus, refreshOnboardingStatus, logout } = useAuth();
  const [showReassurance, setShowReassurance] = useState(false);

  if (!onboardingStatus) return null;

  let step: React.ReactNode = null;
  if (onboardingStatus.status === "PENDING_PHONE") {
    step = <PhoneVerificationForm onSubmitted={() => void refreshOnboardingStatus()} />;
  } else if (onboardingStatus.status === "PENDING_PII") {
    step = <PiiForm onSubmitted={() => { setShowReassurance(true); void refreshOnboardingStatus(); }} />;
  } else if (showReassurance) {
    step = <AnonymityModal onContinue={() => setShowReassurance(false)} />;
  } else if (onboardingStatus.status === "PENDING_HISTORY") {
    step = <HistoryForm onSubmitted={() => void refreshOnboardingStatus()} />;
  } else if (onboardingStatus.status === "PENDING_AVATAR") {
    step = <AvatarPicker onSubmitted={() => void refreshOnboardingStatus()} />;
  }

  return (
    <>
      {step}
      {/* Every onboarding step is a non-dismissable full-screen modal (by
          design — steps can't be skipped), which otherwise leaves no way
          out at all if someone can't finish a step right now (e.g. no SMS
          set up yet). z-[60] sits above the modals' z-50 so this stays
          clickable regardless of which step is showing. */}
      <button
        onClick={logout}
        className="fixed top-4 left-4 z-[60] rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition hover:text-foreground"
      >
        Log out
      </button>
    </>
  );
}
