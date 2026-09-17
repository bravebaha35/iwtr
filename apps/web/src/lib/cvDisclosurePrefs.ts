// Client-side-only opt-in flags for whether the member's CV includes their
// account email/phone number (see Fix 2 in the 2026-09-16 final-review
// frontend fix report). Both default OFF: profile.email/profile.phoneNumber
// are decrypted, self-view-only account fields the member never explicitly
// typed for this purpose — unlike displayName/customExperienceText, which
// they do type themselves — so disclosure requires an explicit opt-in via
// the checkboxes on /me's "My CV" tab, not a server-side field. Persisting
// this as a real User column would mean touching Prisma/shared-types/the
// API again, out of scope for a fix wave, so it's tracked client-side only.
//
// Both CvPreview.tsx's live preview (on /me) and ApplyButton.tsx's hidden
// snapshot instance read these same two values, so the PDF a company
// receives always matches exactly what the member last saw checked on /me.
//
// Read/write wrapped in try/catch per this codebase's established
// localStorage-safety convention (see lib/emailVerification.ts's
// savePendingVerification/loadPendingVerification) — a private/locked-down
// browser should silently fall back to "not disclosed," never crash the CV
// tab or the Apply flow.
const SHOW_EMAIL_KEY = "iwtr:cv-show-email";
const SHOW_PHONE_KEY = "iwtr:cv-show-phone";
// Same client-side-only tracking, same reasoning, for the Apply-flow CV
// gate (ApplyButton.tsx): HAS_SAVED_CV flips true the first time the member
// ever saves the "My CV" tab (see /me's saveCv) — until then, Apply redirects
// there instead of sending a CV nobody has looked at. HAS_SEEN_APPLY_PROMPT
// tracks the one-time "before you apply" nudge separately: it's shown at
// most once ever, even across multiple Apply attempts before the member
// actually saves a CV.
const HAS_SAVED_CV_KEY = "iwtr:cv-has-saved";
const HAS_SEEN_APPLY_PROMPT_KEY = "iwtr:cv-has-seen-apply-prompt";

function getFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function setFlag(key: string, value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(key, "1");
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage can throw in privacy-locked-down browsers — losing the saved
    // preference isn't worth crashing the CV tab over.
  }
}

export function getCvShowEmail(): boolean {
  return getFlag(SHOW_EMAIL_KEY);
}

export function setCvShowEmail(value: boolean): void {
  setFlag(SHOW_EMAIL_KEY, value);
}

export function getCvShowPhone(): boolean {
  return getFlag(SHOW_PHONE_KEY);
}

export function setCvShowPhone(value: boolean): void {
  setFlag(SHOW_PHONE_KEY, value);
}

export function getHasSavedCv(): boolean {
  return getFlag(HAS_SAVED_CV_KEY);
}

export function markCvSaved(): void {
  setFlag(HAS_SAVED_CV_KEY, true);
}

export function getHasSeenApplyCvPrompt(): boolean {
  return getFlag(HAS_SEEN_APPLY_PROMPT_KEY);
}

export function markSeenApplyCvPrompt(): void {
  setFlag(HAS_SEEN_APPLY_PROMPT_KEY, true);
}
