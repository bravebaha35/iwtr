"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { PiiForm } from "./PiiForm";
import { AnonymityModal } from "./AnonymityModal";
import { HistoryForm } from "./HistoryForm";
import { AvatarPicker } from "./AvatarPicker";

export function OnboardingFlow() {
  const { onboardingStatus, refreshOnboardingStatus } = useAuth();
  const [showReassurance, setShowReassurance] = useState(false);

  if (!onboardingStatus) return null;

  if (onboardingStatus.status === "PENDING_PII") {
    return <PiiForm onSubmitted={() => { setShowReassurance(true); void refreshOnboardingStatus(); }} />;
  }

  if (showReassurance) {
    return <AnonymityModal onContinue={() => setShowReassurance(false)} />;
  }

  if (onboardingStatus.status === "PENDING_HISTORY") {
    return <HistoryForm onSubmitted={() => void refreshOnboardingStatus()} />;
  }

  if (onboardingStatus.status === "PENDING_AVATAR") {
    return <AvatarPicker onSubmitted={() => void refreshOnboardingStatus()} />;
  }

  return null;
}
