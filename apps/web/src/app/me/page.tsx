"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  EduLevel,
  EducationHistoryEntry,
  MyEmploymentEntry,
  MyProfile,
} from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch, apiPost, apiDelete, ApiError } from "@/lib/api-client";
import { avatarLabel } from "@/lib/avatars";
import { Avatar } from "@/components/Avatar";
import { AvatarEditor } from "@/components/AvatarEditor";
import { LocationPicker, type LocationValue } from "@/components/LocationPicker";
import { WorkplacePicker } from "@/components/WorkplacePicker";
import { DateDropdownPicker } from "@/components/DateDropdownPicker";
import { PhoneNumberInput } from "@/components/PhoneNumberInput";

const SUPPORT_EMAIL = "support@iwtr.com";

const EDU_LEVELS: { level: EduLevel; label: string }[] = [
  { level: "ELEMENTARY", label: "Elementary School" },
  { level: "HIGH_SCHOOL", label: "High School" },
  { level: "COLLEGE", label: "College" },
];

function eduLevelLabel(level: EduLevel): string {
  return EDU_LEVELS.find((l) => l.level === level)?.label ?? level;
}

// Elementary -> High School -> College, always — the backend already returns
// entries in this order, but a freshly-added entry is appended to local
// state without a refetch (see addEducation), so this re-sorts on render
// rather than trusting insertion order to stay correct.
function eduLevelRank(level: EduLevel): number {
  return EDU_LEVELS.findIndex((l) => l.level === level);
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function ProfilePage() {
  const { accessToken, isLoading: authLoading, refreshOnboardingStatus } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [employment, setEmployment] = useState<MyEmploymentEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local editable form state, seeded from the loaded profile.
  const [displayName, setDisplayName] = useState("");
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [avatarGradient, setAvatarGradient] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationValue>({ country: null, city: null, district: null });

  // Feedback lives right next to the button that triggered it, not buried at
  // the bottom of a long page — each section gets its own status/error pair.
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [editingBirthDate, setEditingBirthDate] = useState(false);
  const [birthDateDraft, setBirthDateDraft] = useState<string | null>(null);
  const [birthDateSaving, setBirthDateSaving] = useState(false);
  const [birthDateError, setBirthDateError] = useState<string | null>(null);

  // Phone re-verification is a two-stage flow (request a code, then verify
  // it) — same OTP challenge as onboarding, just reachable from here instead
  // (see ProfileService.requestPhoneChangeOtp/verifyPhoneChangeOtp).
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneStage, setPhoneStage] = useState<"phone" | "otp">("phone");
  const [phoneDraft, setPhoneDraft] = useState("+90");
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  // Only ever set when the API is running outside production with no real
  // SMS provider configured — see PhoneVerificationService.requestOtp.
  const [phoneDevCode, setPhoneDevCode] = useState<string | null>(null);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [showAddEdu, setShowAddEdu] = useState(false);
  const [newEduLevel, setNewEduLevel] = useState<EduLevel>("COLLEGE");
  const [newEduInstitution, setNewEduInstitution] = useState("");
  const [newEduYear, setNewEduYear] = useState("");
  const [newEduFaculty, setNewEduFaculty] = useState("");
  const [newEduDepartment, setNewEduDepartment] = useState("");
  const [addingEdu, setAddingEdu] = useState(false);
  const [eduError, setEduError] = useState<string | null>(null);
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [editEduLevel, setEditEduLevel] = useState<EduLevel>("COLLEGE");
  const [editEduInstitution, setEditEduInstitution] = useState("");
  const [editEduYear, setEditEduYear] = useState("");
  const [editEduFaculty, setEditEduFaculty] = useState("");
  const [editEduDepartment, setEditEduDepartment] = useState("");

  const [showAddJob, setShowAddJob] = useState(false);
  const [newJobCompany, setNewJobCompany] = useState<{ companyId: string | null; name: string; slug: string | null } | null>(
    null,
  );
  const [newJobStart, setNewJobStart] = useState<string | null>(null);
  const [newJobEnd, setNewJobEnd] = useState<string | null>(null);
  const [addingJob, setAddingJob] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editJobStart, setEditJobStart] = useState<string | null>(null);
  const [editJobEnd, setEditJobEnd] = useState<string | null>(null);

  // Can't have worked anywhere before you were born — the date pickers for
  // employment history (add or edit) never offer years earlier than this.
  const birthYear = profile?.birthDate ? new Date(profile.birthDate).getFullYear() : undefined;

  // Mirrors ProfileService.updateProfile's 14-day cooldown so the input can
  // be disabled client-side instead of just failing on save — 0 means no
  // cooldown (either never changed, or the window's already elapsed).
  const DISPLAY_NAME_COOLDOWN_DAYS = 14;
  const displayNameCooldownDaysLeft = (() => {
    if (!profile?.displayNameChangedAt) return 0;
    const elapsedMs = Date.now() - new Date(profile.displayNameChangedAt).getTime();
    const cooldownMs = DISPLAY_NAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    if (elapsedMs >= cooldownMs) return 0;
    return Math.ceil((cooldownMs - elapsedMs) / (24 * 60 * 60 * 1000));
  })();

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [profileData, employmentData] = await Promise.all([
        apiGet<MyProfile>("/me/profile", accessToken),
        apiGet<MyEmploymentEntry[]>("/me/employment-history", accessToken),
      ]);
      setProfile(profileData);
      setEmployment(employmentData);
      setDisplayName(profileData.displayName ?? "");
      setAvatarKey(profileData.avatarKey);
      setAvatarGradient(profileData.avatarGradient);
      setLocation({ country: profileData.country, city: profileData.city, district: profileData.district });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your profile.");
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveAvatarAndName() {
    setAvatarSaving(true);
    setAvatarError(null);
    setAvatarStatus(null);
    try {
      // Always send all three — no truthy-check omission here. displayName
      // can legitimately be an empty string (clears it back to the default),
      // and avatarKey/avatarGradient are always set by the time this button
      // is reachable, but there's no reason to make "did the value happen to
      // be falsy" a factor in whether a field gets saved at all.
      await apiPatch(
        "/me/profile",
        { displayName, avatarKey, avatarGradient },
        accessToken ?? undefined,
      );
      await load();
      // The homepage header reads avatar/name from AuthContext's
      // onboardingStatus, not from this page's own `profile` state — without
      // this, a save here looks like it silently reverted once you navigate
      // back, because that separate cache was never told anything changed.
      await refreshOnboardingStatus();
      setAvatarStatus("Saved.");
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setAvatarSaving(false);
    }
  }

  async function saveLocation() {
    if (!location.country || !location.city) return;
    setLocationSaving(true);
    setLocationError(null);
    setLocationStatus(null);
    try {
      await apiPatch(
        "/me/profile",
        { country: location.country, city: location.city, district: location.district || "" },
        accessToken ?? undefined,
      );
      await load();
      await refreshOnboardingStatus();
      setLocationStatus("Saved.");
    } catch (err) {
      setLocationError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setLocationSaving(false);
    }
  }

  function startEditBirthDate() {
    setBirthDateDraft(profile?.birthDate ?? null);
    setBirthDateError(null);
    setEditingBirthDate(true);
  }

  async function saveBirthDate() {
    if (!birthDateDraft) return;
    setBirthDateSaving(true);
    setBirthDateError(null);
    try {
      await apiPatch("/me/identity", { birthDate: birthDateDraft }, accessToken ?? undefined);
      await load();
      setEditingBirthDate(false);
    } catch (err) {
      setBirthDateError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setBirthDateSaving(false);
    }
  }

  function startEditPhone() {
    setPhoneDraft(profile?.phoneNumber ?? "+90");
    setPhoneStage("phone");
    setPhoneOtpCode("");
    setPhoneDevCode(null);
    setPhoneError(null);
    setEditingPhone(true);
  }

  async function sendPhoneOtp() {
    setPhoneSaving(true);
    setPhoneError(null);
    try {
      const result = await apiPost<{ devCode?: string }>(
        "/me/phone/request-otp",
        { phoneNumber: phoneDraft },
        accessToken ?? undefined,
      );
      setPhoneDevCode(result.devCode ?? null);
      setPhoneStage("otp");
    } catch (err) {
      setPhoneError(err instanceof ApiError ? err.message : "Couldn't send a code.");
    } finally {
      setPhoneSaving(false);
    }
  }

  async function verifyPhoneOtp() {
    setPhoneSaving(true);
    setPhoneError(null);
    try {
      await apiPost("/me/phone/verify-otp", { code: phoneOtpCode }, accessToken ?? undefined);
      await load();
      setEditingPhone(false);
    } catch (err) {
      setPhoneError(err instanceof ApiError ? err.message : "Couldn't verify that code.");
    } finally {
      setPhoneSaving(false);
    }
  }

  async function addEducation() {
    if (!newEduInstitution.trim()) return;
    setAddingEdu(true);
    setEduError(null);
    try {
      const created = await apiPost<EducationHistoryEntry>(
        "/me/education-history",
        {
          level: newEduLevel,
          institutionName: newEduInstitution.trim(),
          graduationYear: newEduYear ? Number(newEduYear) : undefined,
          faculty: newEduLevel === "COLLEGE" && newEduFaculty.trim() ? newEduFaculty.trim() : undefined,
          department:
            (newEduLevel === "COLLEGE" || newEduLevel === "HIGH_SCHOOL") && newEduDepartment.trim()
              ? newEduDepartment.trim()
              : undefined,
        },
        accessToken ?? undefined,
      );
      setProfile((prev) => (prev ? { ...prev, education: [...prev.education, created] } : prev));
      setNewEduInstitution("");
      setNewEduYear("");
      setNewEduFaculty("");
      setNewEduDepartment("");
      setShowAddEdu(false);
    } catch (err) {
      setEduError(err instanceof ApiError ? err.message : "Couldn't add that.");
    } finally {
      setAddingEdu(false);
    }
  }

  function startEditEducation(entry: EducationHistoryEntry) {
    setEditingEduId(entry.id);
    setEditEduLevel(entry.level);
    setEditEduInstitution(entry.institutionName);
    setEditEduYear(entry.graduationYear ? String(entry.graduationYear) : "");
    setEditEduFaculty(entry.faculty ?? "");
    setEditEduDepartment(entry.department ?? "");
    setEduError(null);
  }

  async function saveEditEducation() {
    if (!editingEduId || !editEduInstitution.trim()) return;
    setEduError(null);
    try {
      const updated = await apiPatch<EducationHistoryEntry>(
        `/me/education-history/${editingEduId}`,
        {
          level: editEduLevel,
          institutionName: editEduInstitution.trim(),
          graduationYear: editEduYear ? Number(editEduYear) : null,
          faculty: editEduLevel === "COLLEGE" ? (editEduFaculty.trim() || null) : null,
          department:
            editEduLevel === "COLLEGE" || editEduLevel === "HIGH_SCHOOL" ? (editEduDepartment.trim() || null) : null,
        },
        accessToken ?? undefined,
      );
      setProfile((prev) =>
        prev ? { ...prev, education: prev.education.map((e) => (e.id === updated.id ? updated : e)) } : prev,
      );
      setEditingEduId(null);
    } catch (err) {
      setEduError(err instanceof ApiError ? err.message : "Couldn't save that.");
    }
  }

  async function deleteEducation(id: string) {
    setEduError(null);
    try {
      await apiDelete(`/me/education-history/${id}`, accessToken ?? undefined);
      setProfile((prev) => (prev ? { ...prev, education: prev.education.filter((e) => e.id !== id) } : prev));
    } catch (err) {
      setEduError(err instanceof ApiError ? err.message : "Couldn't remove that.");
    }
  }

  async function addEmployment() {
    // companyId is never actually null here — WorkplacePicker below doesn't
    // set allowFreeText, so it only ever calls onPick with a real picked
    // company — but the type is shared with onboarding's free-text-capable
    // usage, so this guards defensively rather than asserting it away.
    if (!newJobCompany?.companyId) return;
    setAddingJob(true);
    setJobError(null);
    try {
      const created = await apiPost<MyEmploymentEntry>(
        "/me/employment-history",
        { companyId: newJobCompany.companyId, startDate: newJobStart, endDate: newJobEnd },
        accessToken ?? undefined,
      );
      setEmployment((prev) => (prev ? [...prev, created] : [created]));
      setNewJobCompany(null);
      setNewJobStart(null);
      setNewJobEnd(null);
      setShowAddJob(false);
    } catch (err) {
      setJobError(err instanceof ApiError ? err.message : "Couldn't add that.");
    } finally {
      setAddingJob(false);
    }
  }

  function startEditEmployment(entry: MyEmploymentEntry) {
    setEditingJobId(entry.id);
    setEditJobStart(entry.startDate);
    setEditJobEnd(entry.endDate);
    setJobError(null);
  }

  async function saveEditEmployment() {
    if (!editingJobId) return;
    setJobError(null);
    try {
      const updated = await apiPatch<MyEmploymentEntry>(
        `/me/employment-history/${editingJobId}`,
        { startDate: editJobStart, endDate: editJobEnd },
        accessToken ?? undefined,
      );
      setEmployment((prev) => (prev ? prev.map((e) => (e.id === updated.id ? updated : e)) : prev));
      setEditingJobId(null);
    } catch (err) {
      setJobError(err instanceof ApiError ? err.message : "Couldn't save that.");
    }
  }

  async function deleteEmployment(id: string) {
    setJobError(null);
    try {
      await apiDelete(`/me/employment-history/${id}`, accessToken ?? undefined);
      setEmployment((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
    } catch (err) {
      setJobError(err instanceof ApiError ? err.message : "Couldn't remove that.");
    }
  }

  if (authLoading) return null;

  if (!accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Log in to see your account settings.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        &larr; Back
      </Link>
      <h1 className="mt-4 mb-6 text-2xl font-bold text-foreground">Your account</h1>

      {profile === null ? (
        error ? (
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <Link href="/" className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400">
              &larr; Back home
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )
      ) : (
        <div className="flex flex-col gap-6">
          {/* Avatar, display name, background */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center gap-3">
              <Avatar avatarKey={avatarKey} avatarGradient={avatarGradient} size="md" />
              <label className="flex-1 text-xs font-medium text-muted-foreground">
                Display name — only you see this; pick anything, but not your own name (no offensive content)
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={30}
                  disabled={displayNameCooldownDaysLeft > 0}
                  placeholder={avatarLabel(avatarKey) ?? "Anonymous"}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                />
                {displayNameCooldownDaysLeft > 0 && (
                  <span className="mt-1 block text-muted-foreground">
                    You can change this again in {displayNameCooldownDaysLeft} day
                    {displayNameCooldownDaysLeft === 1 ? "" : "s"}.
                  </span>
                )}
              </label>
            </div>

            <AvatarEditor
              avatarKey={avatarKey}
              avatarGradient={avatarGradient}
              onChangeAvatarKey={setAvatarKey}
              onChangeGradient={setAvatarGradient}
            />

            <button
              onClick={saveAvatarAndName}
              disabled={avatarSaving}
              className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {avatarSaving ? "Saving..." : "Save changes"}
            </button>
            {avatarStatus && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{avatarStatus}</p>}
            {avatarError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{avatarError}</p>}
          </div>

          {/* Personal information */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-semibold text-foreground">Personal Information</h2>

            <p className="mb-1 text-xs font-medium text-muted-foreground">Country, city &amp; district</p>
            <LocationPicker value={location} onChange={setLocation} />
            <button
              onClick={saveLocation}
              disabled={locationSaving || !location.country || !location.city}
              className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
            >
              Save location
            </button>
            {locationStatus && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{locationStatus}</p>}
            {locationError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{locationError}</p>}

            <div className="mt-4 border-t border-border pt-4">
              {/* Placeholder — not wired to anything yet, just here so the
                  planned field isn't forgotten. See the note below it. */}
              <p className="mb-1 text-xs font-medium text-muted-foreground">T.C. Kimlik No</p>
              <input
                disabled
                placeholder="Coming soon"
                className="w-full cursor-not-allowed rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground opacity-60"
              />
            </div>

            <div className="mt-4 border-t border-border pt-4 text-sm">
              <p className="text-xs font-medium text-muted-foreground">Name</p>
              <p className="text-foreground">
                {profile.firstName} {profile.lastName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Can&apos;t be changed here — email{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 hover:underline dark:text-brand-400">
                  {SUPPORT_EMAIL}
                </a>{" "}
                if this needs correcting.
              </p>
            </div>

            <div className="mt-4 border-t border-border pt-4 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Birth date</p>
              {editingBirthDate ? (
                <div className="flex flex-col gap-2">
                  <DateDropdownPicker
                    value={birthDateDraft}
                    onChange={setBirthDateDraft}
                    maxYear={new Date().getFullYear()}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveBirthDate}
                      disabled={birthDateSaving || !birthDateDraft}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {birthDateSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingBirthDate(false)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                    >
                      Cancel
                    </button>
                  </div>
                  {birthDateError && <p className="text-sm text-red-600 dark:text-red-400">{birthDateError}</p>}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-foreground">{formatDate(profile.birthDate) || "—"}</p>
                  <button
                    type="button"
                    onClick={startEditBirthDate}
                    className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-border pt-4 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Verified phone number</p>
              {editingPhone ? (
                <div className="flex flex-col gap-2">
                  {phoneStage === "phone" ? (
                    <>
                      <PhoneNumberInput value={phoneDraft} onChange={setPhoneDraft} />
                      <p className="text-xs text-muted-foreground">
                        We&apos;ll text a 6-digit code to confirm you control this number before it replaces your
                        current one.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        We sent a 6-digit code to {phoneDraft}. It expires in 5 minutes.
                      </p>
                      {phoneDevCode && (
                        <p className="rounded-lg border border-dashed border-brand-300 bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-300">
                          No SMS provider is configured yet — dev mode code:{" "}
                          <span className="font-mono font-semibold">{phoneDevCode}</span>
                        </p>
                      )}
                      <input
                        inputMode="numeric"
                        placeholder="123456"
                        value={phoneOtpCode}
                        onChange={(e) => setPhoneOtpCode(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-center text-lg tracking-[0.5em] text-foreground"
                      />
                    </>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={phoneStage === "phone" ? sendPhoneOtp : verifyPhoneOtp}
                      disabled={phoneSaving || (phoneStage === "otp" && phoneOtpCode.trim().length !== 6)}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {phoneSaving
                        ? phoneStage === "phone"
                          ? "Sending..."
                          : "Verifying..."
                        : phoneStage === "phone"
                          ? "Send code"
                          : "Verify"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPhone(false)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                    >
                      Cancel
                    </button>
                  </div>
                  {phoneError && <p className="text-sm text-red-600 dark:text-red-400">{phoneError}</p>}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-foreground">{profile.phoneNumber ?? "—"}</p>
                  <button
                    type="button"
                    onClick={startEditPhone}
                    className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
              We&apos;re not collecting a T.C. Kimlik No yet — for now, your phone number verified by SMS/OTP is
              what confirms your account. When that&apos;s added, it&apos;ll be from this page, used once, then
              removed — we never hold on to national ID numbers.
            </p>
          </div>

          {/* Education */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-semibold text-foreground">Education</h2>
            {profile.education.length > 0 && (
              <ul className="mb-4 flex flex-col gap-2">
                {[...profile.education].sort((a, b) => eduLevelRank(a.level) - eduLevelRank(b.level)).map((e) =>
                  editingEduId === e.id ? (
                    <li key={e.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                      <div className="grid grid-cols-8 gap-2">
                        <select
                          value={editEduLevel}
                          onChange={(ev) => setEditEduLevel(ev.target.value as EduLevel)}
                          className="col-span-2 rounded-lg border border-border bg-surface-muted px-2 py-1.5 text-xs text-foreground"
                        >
                          {EDU_LEVELS.map((l) => (
                            <option key={l.level} value={l.level}>
                              {l.label}
                            </option>
                          ))}
                        </select>
                        <input
                          value={editEduInstitution}
                          onChange={(ev) => setEditEduInstitution(ev.target.value)}
                          className="col-span-4 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                        />
                        <input
                          value={editEduYear}
                          onChange={(ev) => setEditEduYear(ev.target.value)}
                          inputMode="numeric"
                          placeholder="Year"
                          className="col-span-2 rounded-lg border border-border bg-surface-muted px-2 py-1.5 text-xs text-foreground"
                        />
                      </div>
                      {editEduLevel === "COLLEGE" && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={editEduFaculty}
                            onChange={(ev) => setEditEduFaculty(ev.target.value)}
                            placeholder="Faculty"
                            className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                          />
                          <input
                            value={editEduDepartment}
                            onChange={(ev) => setEditEduDepartment(ev.target.value)}
                            placeholder="Department (optional)"
                            className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                          />
                        </div>
                      )}
                      {editEduLevel === "HIGH_SCHOOL" && (
                        <input
                          value={editEduDepartment}
                          onChange={(ev) => setEditEduDepartment(ev.target.value)}
                          placeholder="Department (optional)"
                          className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                        />
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={saveEditEducation}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingEduId(null)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </li>
                  ) : (
                    <li key={e.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        {e.institutionName}{" "}
                        <span className="text-muted-foreground">
                          · {eduLevelLabel(e.level)}
                          {e.graduationYear ? ` · Class of ${e.graduationYear}` : ""}
                          {e.faculty ? ` · ${e.faculty}` : ""}
                          {e.department ? ` · ${e.department}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-2 text-xs">
                        <button type="button" onClick={() => startEditEducation(e)} className="text-brand-600 hover:underline dark:text-brand-400">
                          Edit
                        </button>
                        <button type="button" onClick={() => deleteEducation(e.id)} className="text-red-600 hover:underline dark:text-red-400">
                          Remove
                        </button>
                      </span>
                    </li>
                  ),
                )}
              </ul>
            )}
            {eduError && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{eduError}</p>}
            {showAddEdu ? (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="grid grid-cols-8 gap-2">
                  <select
                    value={newEduLevel}
                    onChange={(e) => setNewEduLevel(e.target.value as EduLevel)}
                    className="col-span-2 rounded-lg border border-border bg-surface-muted px-2 py-1.5 text-xs text-foreground"
                  >
                    {EDU_LEVELS.map((l) => (
                      <option key={l.level} value={l.level}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Institution name"
                    value={newEduInstitution}
                    onChange={(e) => setNewEduInstitution(e.target.value)}
                    className="col-span-4 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                  />
                  <input
                    placeholder="Grad. year"
                    inputMode="numeric"
                    value={newEduYear}
                    onChange={(e) => setNewEduYear(e.target.value)}
                    className="col-span-2 rounded-lg border border-border bg-surface-muted px-2 py-1.5 text-xs text-foreground"
                  />
                </div>
                {newEduLevel === "COLLEGE" && newEduInstitution.trim() !== "" && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="Faculty"
                      value={newEduFaculty}
                      onChange={(e) => setNewEduFaculty(e.target.value)}
                      className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                    />
                    <input
                      placeholder="Department (optional)"
                      value={newEduDepartment}
                      onChange={(e) => setNewEduDepartment(e.target.value)}
                      className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                    />
                  </div>
                )}
                {newEduLevel === "HIGH_SCHOOL" && newEduInstitution.trim() !== "" && (
                  <input
                    placeholder="Department (optional)"
                    value={newEduDepartment}
                    onChange={(e) => setNewEduDepartment(e.target.value)}
                    className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addEducation}
                    disabled={addingEdu || !newEduInstitution.trim()}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {addingEdu ? "Adding..." : "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddEdu(false)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddEdu(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                + Add education
              </button>
            )}
          </div>

          {/* Employment history */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-1 font-semibold text-foreground">Employment history</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Pick a real workplace from the list below — no free typing, same as everywhere else on this page.
              Entries you&apos;ve already reviewed can&apos;t be changed or removed.
            </p>
            {employment === null && <p className="text-sm text-muted-foreground">Loading...</p>}
            {employment !== null && employment.length === 0 && (
              <p className="mb-3 text-sm text-muted-foreground">Nothing on file yet.</p>
            )}
            <ul className="mb-3 flex flex-col gap-2">
              {employment?.map((e) =>
                editingJobId === e.id ? (
                  <li key={e.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-foreground">{e.rawCompanyName}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="mb-1 text-[11px] font-medium text-muted-foreground">Start date</p>
                        <DateDropdownPicker
                          value={editJobStart}
                          onChange={(v) => {
                            setEditJobStart(v);
                            const endStillValid =
                              v !== null && editJobEnd !== null && Number(editJobEnd.slice(0, 4)) >= Number(v.slice(0, 4));
                            if (!endStillValid) setEditJobEnd(null);
                          }}
                          minYear={birthYear}
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                          End date {!editJobStart && "— pick a start date first"}
                        </p>
                        <DateDropdownPicker
                          value={editJobEnd}
                          onChange={setEditJobEnd}
                          minYear={editJobStart ? Number(editJobStart.slice(0, 4)) : birthYear}
                          disabled={!editJobStart}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveEditEmployment}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingJobId(null)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </li>
                ) : (
                  <li key={e.id} className="flex items-center justify-between text-sm">
                    <span>
                      {e.companySlug ? (
                        <Link href={`/companies/${e.companySlug}`} className="text-foreground hover:underline">
                          {e.rawCompanyName}
                        </Link>
                      ) : (
                        <span className="text-foreground">{e.rawCompanyName}</span>
                      )}
                      {(e.startDate || e.endDate) && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {e.startDate ?? "?"} &ndash; {e.endDate ?? "present"}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs">
                      {e.hasReview ? (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                          Reviewed
                        </span>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEditEmployment(e)} className="text-brand-600 hover:underline dark:text-brand-400">
                            Edit
                          </button>
                          <button type="button" onClick={() => deleteEmployment(e.id)} className="text-red-600 hover:underline dark:text-red-400">
                            Remove
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                ),
              )}
            </ul>
            {jobError && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{jobError}</p>}

            {showAddJob ? (
              <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <WorkplacePicker onPick={setNewJobCompany} />
                {newJobCompany && (
                  <p className="text-xs text-muted-foreground">
                    Selected: <span className="font-medium text-foreground">{newJobCompany.name}</span>
                  </p>
                )}
                <div>
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">Start date</p>
                  <DateDropdownPicker
                    value={newJobStart}
                    onChange={(v) => {
                      setNewJobStart(v);
                      const endStillValid =
                        v !== null && newJobEnd !== null && Number(newJobEnd.slice(0, 4)) >= Number(v.slice(0, 4));
                      if (!endStillValid) setNewJobEnd(null);
                    }}
                    minYear={birthYear}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                    End date (leave blank if current) {!newJobStart && "— pick a start date first"}
                  </p>
                  <DateDropdownPicker
                    value={newJobEnd}
                    onChange={setNewJobEnd}
                    minYear={newJobStart ? Number(newJobStart.slice(0, 4)) : birthYear}
                    disabled={!newJobStart}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addEmployment}
                    disabled={addingJob || !newJobCompany}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {addingJob ? "Adding..." : "Add workplace"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddJob(false)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddJob(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                + Add workplace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
