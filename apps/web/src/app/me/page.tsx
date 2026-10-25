"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ANONYMOUS_USERNAMES_BY_WORKPLACE_TYPE,
  LANGUAGES,
  MAX_LANGUAGES_PER_MEMBER,
  languageLabel,
  type EduLevel,
  type EducationHistoryEntry,
  type EmployerProfileView,
  type MyEmploymentEntry,
  type MyProfile,
  type Sector,
  type WorkplaceType,
} from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch, apiPost, apiDelete, ApiError } from "@/lib/api-client";
import { avatarGender, avatarKeyForGender, avatarLabel, type AvatarGender } from "@/lib/avatars";
import {
  getCvHiddenSections,
  getCvShowEmail,
  getCvShowPhone,
  markCvSaved,
  setCvHiddenSections,
  setCvShowEmail,
  setCvShowPhone,
  type CvSectionKey,
} from "@/lib/cvDisclosurePrefs";
import { Avatar } from "@/components/Avatar";
import { AvatarEditor, GenderToggle } from "@/components/AvatarEditor";
import { WorkTypePicker } from "@/components/WorkTypePicker";
import { AvatarPhotoUploader } from "@/components/profile/AvatarPhotoUploader";
import { SkillsPicker } from "@/components/profile/SkillsPicker";
import { SingleSelectDropdown, type DropdownOption } from "@/components/Dropdown";
import { LocationPicker, type LocationValue } from "@/components/LocationPicker";
import { WorkplacePicker } from "@/components/WorkplacePicker";
import { DateDropdownPicker } from "@/components/DateDropdownPicker";
import { PhoneNumberInput } from "@/components/PhoneNumberInput";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { AccountOptionsPanel } from "@/components/profile/AccountOptionsPanel";
import { CvPage, CvPreview } from "@/components/profile/CvPreview";
import { ReferencesPanel } from "@/components/profile/ReferencesPanel";
import { CertificatesSection } from "@/components/profile/CertificatesSection";
import { MyRatingsPanel } from "@/components/profile/MyRatingsPanel";
import { cvFileName, renderCvPdf } from "@/lib/cvPdf";
import { SidebarContentRow } from "@/components/layout/SidebarShell";
import { SettingsNav } from "@/components/layout/SettingsNav";
import { PROFILE_TABS, profileTabsFor, type ProfileTabKey } from "@/components/profile/profileTabs";
import { useI18n } from "@/lib/i18n/client";
import { intlLocale, languageName, type Locale } from "@/lib/i18n/core";

const SUPPORT_EMAIL = "iworkedthere@hotmail.com";

type TabKey = ProfileTabKey;

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

function sectorAppliesTo(sector: Sector, workType: WorkplaceType): boolean {
  return sector.workplaceTypes.includes(workType);
}

function formatDate(iso: string | null, locale: Locale): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(intlLocale(locale), { year: "numeric", month: "long", day: "numeric" });
}

// useSearchParams (the ?tab= deep link) needs a Suspense boundary so
// the page can still be prerendered; the inner component does the work.
export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilePageContent />
    </Suspense>
  );
}

function ProfilePageContent() {
  const { isAuthenticated, isLoading: authLoading, refreshOnboardingStatus, patchOnboardingStatus, role } = useAuth();
  const { t, locale } = useI18n();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  // Only a claimed+APPROVED owner has this at all (GET 403s otherwise, see
  // EmployerProfileService.requireVerifiedEmployer) — null here means
  // "not a verified employer," not "still loading," so the photo box below
  // simply doesn't render rather than showing a loading state forever.
  const [employerProfile, setEmployerProfile] = useState<EmployerProfileView | null>(null);
  const [employment, setEmployment] = useState<MyEmploymentEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("customize");
  const [cvFullscreen, setCvFullscreen] = useState(false);
  const [cvDownloading, setCvDownloading] = useState(false);
  const [cvDownloadError, setCvDownloadError] = useState<string | null>(null);
  const cvPrintRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  // Lets ApplyButton.tsx's CV gate land a member directly on this tab
  // (`/me?tab=cv`) instead of the default "Customize" tab.
  // Re-runs when the URL's query changes (a notification clicked while
  // already on /me doesn't remount the page); tab clicks are pure client
  // state and don't touch the URL, so they never retrigger this.
  const tabParam = searchParams.get("tab");
  useEffect(() => {
    if (PROFILE_TABS.some((t) => t.key === tabParam)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing tab state from the URL
      setActiveTab(tabParam as TabKey);
    }
  }, [tabParam]);

  // Local editable form state, seeded from the loaded profile.
  const [reviewUsername, setReviewUsername] = useState<string | null>(null);
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [avatarGradient, setAvatarGradient] = useState<string | null>(null);
  // Which set of beavers the picker shows; read from the saved avatar.
  const [avatarGenderDraft, setAvatarGenderDraft] = useState<AvatarGender>("MALE");
  // Members only: show the username (not the CV display name) top-right.
  const [showUsernameDraft, setShowUsernameDraft] = useState(false);
  const [languagesError, setLanguagesError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationValue>({ country: null, city: null, district: null });

  // My CV tab — seeded from `profile` in load(), same as every other draft
  // field on this page.
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [isPublicEmployeeDraft, setIsPublicEmployeeDraft] = useState(false);
  const [customExperienceDraft, setCustomExperienceDraft] = useState("");
  const [cvSaving, setCvSaving] = useState(false);
  const [cvStatus, setCvStatus] = useState<string | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);

  // Personal Information tab — work-type/sector/skills, seeded from
  // `profile` in load() same as every other draft field on this page.
  const [workTypeDraft, setWorkTypeDraft] = useState<WorkplaceType | null>(null);
  const [sectorIdDraft, setSectorIdDraft] = useState<string | null>(null);
  const [skillIdsDraft, setSkillIdsDraft] = useState<string[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalStatus, setPersonalStatus] = useState<string | null>(null);
  const [personalError, setPersonalError] = useState<string | null>(null);
  // Client-side-only opt-in flags (see lib/cvDisclosurePrefs.ts) — not part
  // of the profile PATCH below, so they're not seeded from `profile` in
  // load() like the other CV fields; they're read from localStorage once on
  // mount instead, in the effect below.
  const [showEmailOnCv, setShowEmailOnCv] = useState(false);
  const [showPhoneOnCv, setShowPhoneOnCv] = useState(false);
  // Parts of the CV switched off in "What's on your CV" (same storage).
  const [hiddenCvSections, setHiddenCvSections] = useState<CvSectionKey[]>([]);

  // Feedback lives right next to the button that triggered it, not buried at
  // the bottom of a long page — each section gets its own status/error pair.
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  // Locked/greyed out by default — location is now a required step during
  // registration (see PiiForm), so there's normally already a value here and
  // the common case is "just look at it", not "edit it". Only starts
  // unlocked for pre-existing accounts from before that requirement existed,
  // which may not have one on file yet.
  const [editingLocation, setEditingLocation] = useState(false);

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
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newJobStart, setNewJobStart] = useState<string | null>(null);
  const [newJobEnd, setNewJobEnd] = useState<string | null>(null);
  const [addingJob, setAddingJob] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editJobStart, setEditJobStart] = useState<string | null>(null);
  const [editJobEnd, setEditJobEnd] = useState<string | null>(null);

  // Can't have worked anywhere before you were born — the date pickers for
  // employment history (add or edit) never offer years earlier than this.
  const birthYear = profile?.birthDate ? new Date(profile.birthDate).getFullYear() : undefined;

  const usernameOptions: DropdownOption[] = ANONYMOUS_USERNAMES_BY_WORKPLACE_TYPE[workTypeDraft ?? "OFFICE"].map((name) => ({
    value: name,
    label: name,
  }));

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [profileData, employmentData] = await Promise.all([
        apiGet<MyProfile>("/me/profile"),
        apiGet<MyEmploymentEntry[]>("/me/employment-history"),
      ]);
      setProfile(profileData);
      setEmployment(employmentData);
      setReviewUsername(profileData.reviewUsername);
      setAvatarKey(profileData.avatarKey);
      setAvatarGenderDraft(avatarGender(profileData.avatarKey) ?? "MALE");
      setAvatarGradient(profileData.avatarGradient);
      setShowUsernameDraft(profileData.showUsernameInHeader);
      setLocation({ country: profileData.country, city: profileData.city, district: profileData.district });
      setEditingLocation(!profileData.country || !profileData.city);
      setDisplayNameDraft(profileData.displayName ?? "");
      setIsPublicEmployeeDraft(profileData.isPublicEmployee);
      setCustomExperienceDraft(profileData.customExperienceText ?? "");
      setWorkTypeDraft(profileData.workType);
      setSectorIdDraft(profileData.sector?.id ?? null);
      setSkillIdsDraft(profileData.skills.map((s) => s.id));
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("Couldn't load your profile."));
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  // One-time fetch for the Personal Information tab's cascading Sector
  // dropdown — sectors are a small, static-ish lookup table, not something
  // that needs refetching after every save the way `profile` does.
  useEffect(() => {
    let cancelled = false;
    apiGet<Sector[]>("/sectors")
      .then((data) => {
        if (!cancelled) setSectors(data);
      })
      .catch(() => {
        if (!cancelled) setSectors([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reads the two localStorage-backed CV disclosure flags once on mount —
  // done in an effect, not a lazy useState initializer, since this is a
  // client component that Next.js still renders once on the server first,
  // where localStorage doesn't exist (getCvShowEmail/getCvShowPhone already
  // guard that internally, but reading them from an effect keeps this in
  // line with how settings-context.tsx reads its own localStorage value).
  useEffect(() => {
    setShowEmailOnCv(getCvShowEmail());
    setShowPhoneOnCv(getCvShowPhone());
    setHiddenCvSections(getCvHiddenSections());
  }, []);

  function toggleCvSection(section: CvSectionKey) {
    setHiddenCvSections((prev) => {
      const next = prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section];
      setCvHiddenSections(next);
      return next;
    });
  }

  function toggleShowEmailOnCv(checked: boolean) {
    setShowEmailOnCv(checked);
    setCvShowEmail(checked);
  }

  function toggleShowPhoneOnCv(checked: boolean) {
    setShowPhoneOnCv(checked);
    setCvShowPhone(checked);
  }

  useEffect(() => {
    if (!isAuthenticated || role !== "COMPANY_OWNER") {
      setEmployerProfile(null);
      return;
    }
    let cancelled = false;
    apiGet<EmployerProfileView>("/me/employer-profile")
      .then((data) => {
        if (!cancelled) setEmployerProfile(data);
      })
      .catch(() => {
        if (!cancelled) setEmployerProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, role]);

  async function saveCustomization() {
    setAvatarSaving(true);
    setAvatarError(null);
    setAvatarStatus(null);
    try {
      // Always send avatarKey/avatarGradient — always set by the time this
      // button is reachable (onboarding assigns a starting reviewUsername
      // automatically), so there's no reason to make "did the value happen
      // to be falsy" a factor in whether a field gets saved at all.
      // Owners pick a username too (2026-10-15); the "show it in the
      // corner" choice is a member's only - an owner's corner always shows
      // their real name.
      await apiPatch("/me/profile", {
        avatarKey,
        avatarGradient,
        reviewUsername,
        ...(role === "COMPANY_OWNER" ? {} : { showUsernameInHeader: showUsernameDraft }),
      });
      await load();
      // The homepage header reads avatar/name from AuthContext's
      // onboardingStatus, not from this page's own `profile` state — without
      // this, a save here looks like it silently reverted once you navigate
      // back, because that separate cache was never told anything changed.
      await refreshOnboardingStatus();
      setAvatarStatus(t("Saved."));
    } catch (err) {
      setAvatarError(err instanceof ApiError ? t(err.message) : t("Couldn't save changes."));
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
      await apiPatch("/me/profile", {
        country: location.country,
        city: location.city,
        // Omit rather than send "" — updateProfileInputSchema's district is
        // z.string().min(1).optional(), so an empty string fails validation
        // (400) while an omitted key just leaves the stored district as-is.
        district: location.district ?? undefined,
      });
      await load();
      await refreshOnboardingStatus();
      setLocationStatus(t("Saved."));
      setEditingLocation(false);
    } catch (err) {
      setLocationError(err instanceof ApiError ? t(err.message) : t("Couldn't save changes."));
    } finally {
      setLocationSaving(false);
    }
  }

  // Languages save the moment one is added or removed - on their own, so
  // unsaved edits elsewhere on this tab (work type, sector, skills) are left
  // exactly as they are. If the save fails the list goes back.
  async function saveLanguages(next: string[]) {
    if (!profile) return;
    const previous = profile.languages;
    setLanguagesError(null);
    setProfile({ ...profile, languages: next });
    try {
      await apiPatch("/me/profile", { languages: next });
    } catch (err) {
      setProfile((p) => (p ? { ...p, languages: previous } : p));
      setLanguagesError(err instanceof ApiError ? t(err.message) : t("Couldn't save your languages."));
    }
  }

  async function saveCv() {
    setCvSaving(true);
    setCvError(null);
    setCvStatus(null);
    try {
      await apiPatch("/me/profile", {
        displayName: displayNameDraft.trim(),
        isPublicEmployee: isPublicEmployeeDraft,
        customExperienceText: customExperienceDraft.trim(),
      });
      await load();
      // GlobalHeader reads displayName from AuthContext's onboardingStatus,
      // not this page's own `profile` state — same reason saveCustomization
      // refreshes it after an avatar/username change.
      await refreshOnboardingStatus();
      // Clears ApplyButton's redirect-to-CV gate for this member permanently
      // — see cvDisclosurePrefs.ts's doc comment.
      markCvSaved();
      setCvStatus(t("Saved."));
    } catch (err) {
      setCvError(err instanceof ApiError ? t(err.message) : t("Couldn't save changes."));
    } finally {
      setCvSaving(false);
    }
  }

  // My CV > Download PDF: the same file an employer gets with an application.
  async function downloadCv() {
    if (cvDownloading) return;
    setCvDownloadError(null);
    // A CV needs a name: without one the PDF would say "Your name here".
    if (!(displayNameDraft || profile?.displayName || "").trim()) {
      setCvDownloadError(t("Add your display name above first."));
      return;
    }
    setCvDownloading(true);
    try {
      // Wait for the off-screen full-size copy to mount.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!cvPrintRef.current) throw new Error("not mounted");
      const pdf = await renderCvPdf(cvPrintRef.current, t("Made in iworkedthere.com"));
      pdf.save(cvFileName(displayNameDraft || profile?.displayName, locale));
    } catch {
      setCvDownloadError(t("Couldn't make the PDF. Please try again."));
    } finally {
      setCvDownloading(false);
    }
  }

  async function savePersonalWorkInfo() {
    setPersonalSaving(true);
    setPersonalError(null);
    setPersonalStatus(null);
    try {
      await apiPatch("/me/profile", {
        ...(workTypeDraft ? { workType: workTypeDraft } : {}),
        sectorId: sectorIdDraft ?? "",
        skillIds: skillIdsDraft,
        customExperienceText: customExperienceDraft.trim(),
      });
      await load();
      setPersonalStatus(t("Saved."));
    } catch (err) {
      setPersonalError(err instanceof ApiError ? t(err.message) : t("Couldn't save changes."));
    } finally {
      setPersonalSaving(false);
    }
  }

  function handleWorkTypeChange(type: WorkplaceType) {
    setWorkTypeDraft(type);
    // A sector from a different work type is no longer valid once the type
    // changes — clear it so the cascading dropdown can't silently keep a
    // stale value the backend would reject on save.
    setSectorIdDraft(null);
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
      await apiPatch("/me/identity", { birthDate: birthDateDraft });
      await load();
      setEditingBirthDate(false);
    } catch (err) {
      setBirthDateError(err instanceof ApiError ? t(err.message) : t("Couldn't save changes."));
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
      const result = await apiPost<{ devCode?: string }>("/me/phone/request-otp", { phoneNumber: phoneDraft });
      setPhoneDevCode(result.devCode ?? null);
      setPhoneStage("otp");
    } catch (err) {
      setPhoneError(err instanceof ApiError ? t(err.message) : t("Couldn't send a code."));
    } finally {
      setPhoneSaving(false);
    }
  }

  async function verifyPhoneOtp() {
    setPhoneSaving(true);
    setPhoneError(null);
    try {
      await apiPost("/me/phone/verify-otp", { code: phoneOtpCode });
      await load();
      setEditingPhone(false);
    } catch (err) {
      setPhoneError(err instanceof ApiError ? t(err.message) : t("Couldn't verify that code."));
    } finally {
      setPhoneSaving(false);
    }
  }

  async function addEducation() {
    if (!newEduInstitution.trim()) return;
    if (newEduLevel === "COLLEGE" && !newEduFaculty.trim()) {
      setEduError(t("Faculty is required for a College entry."));
      return;
    }
    setAddingEdu(true);
    setEduError(null);
    try {
      const created = await apiPost<EducationHistoryEntry>("/me/education-history", {
        level: newEduLevel,
        institutionName: newEduInstitution.trim(),
        graduationYear: newEduYear ? Number(newEduYear) : undefined,
        faculty: newEduLevel === "COLLEGE" && newEduFaculty.trim() ? newEduFaculty.trim() : undefined,
        department:
          (newEduLevel === "COLLEGE" || newEduLevel === "HIGH_SCHOOL") && newEduDepartment.trim()
            ? newEduDepartment.trim()
            : undefined,
      });
      setProfile((prev) => (prev ? { ...prev, education: [...prev.education, created] } : prev));
      setNewEduInstitution("");
      setNewEduYear("");
      setNewEduFaculty("");
      setNewEduDepartment("");
      setShowAddEdu(false);
    } catch (err) {
      setEduError(err instanceof ApiError ? t(err.message) : t("Couldn't add that."));
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
    if (editEduLevel === "COLLEGE" && !editEduFaculty.trim()) {
      setEduError(t("Faculty is required for a College entry."));
      return;
    }
    setEduError(null);
    try {
      const updated = await apiPatch<EducationHistoryEntry>(`/me/education-history/${editingEduId}`, {
        level: editEduLevel,
        institutionName: editEduInstitution.trim(),
        graduationYear: editEduYear ? Number(editEduYear) : null,
        faculty: editEduLevel === "COLLEGE" ? (editEduFaculty.trim() || null) : null,
        department:
          editEduLevel === "COLLEGE" || editEduLevel === "HIGH_SCHOOL" ? (editEduDepartment.trim() || null) : null,
      });
      setProfile((prev) =>
        prev ? { ...prev, education: prev.education.map((e) => (e.id === updated.id ? updated : e)) } : prev,
      );
      setEditingEduId(null);
    } catch (err) {
      setEduError(err instanceof ApiError ? t(err.message) : t("Couldn't save that."));
    }
  }

  async function deleteEducation(id: string) {
    setEduError(null);
    try {
      await apiDelete(`/me/education-history/${id}`);
      setProfile((prev) => (prev ? { ...prev, education: prev.education.filter((e) => e.id !== id) } : prev));
    } catch (err) {
      setEduError(err instanceof ApiError ? t(err.message) : t("Couldn't remove that."));
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
      const created = await apiPost<MyEmploymentEntry>("/me/employment-history", {
        companyId: newJobCompany.companyId,
        jobTitle: newJobTitle.trim() || undefined,
        startDate: newJobStart,
        endDate: newJobEnd,
      });
      setEmployment((prev) => (prev ? [...prev, created] : [created]));
      setNewJobCompany(null);
      setNewJobTitle("");
      setNewJobStart(null);
      setNewJobEnd(null);
      setShowAddJob(false);
    } catch (err) {
      setJobError(err instanceof ApiError ? t(err.message) : t("Couldn't add that."));
    } finally {
      setAddingJob(false);
    }
  }

  function startEditEmployment(entry: MyEmploymentEntry) {
    setEditingJobId(entry.id);
    setEditJobTitle(entry.jobTitle ?? "");
    setEditJobStart(entry.startDate);
    setEditJobEnd(entry.endDate);
    setJobError(null);
  }

  async function saveEditEmployment() {
    if (!editingJobId) return;
    setJobError(null);
    try {
      const updated = await apiPatch<MyEmploymentEntry>(`/me/employment-history/${editingJobId}`, {
        jobTitle: editJobTitle.trim() || null,
        startDate: editJobStart,
        endDate: editJobEnd,
      });
      setEmployment((prev) => (prev ? prev.map((e) => (e.id === updated.id ? updated : e)) : prev));
      setEditingJobId(null);
    } catch (err) {
      setJobError(err instanceof ApiError ? t(err.message) : t("Couldn't save that."));
    }
  }

  async function deleteEmployment(id: string) {
    setJobError(null);
    try {
      await apiDelete(`/me/employment-history/${id}`);
      setEmployment((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
    } catch (err) {
      setJobError(err instanceof ApiError ? t(err.message) : t("Couldn't remove that."));
    }
  }

  // The CV preview shows the unsaved display name and public-sector tick too.
  const cvProfile: MyProfile | null = profile
    ? { ...profile, displayName: displayNameDraft.trim() || null, isPublicEmployee: isPublicEmployeeDraft }
    : null;
  // My CV > "What's on your CV": a tick per part of the CV. A part with
  // something in it can be switched off and on; an empty one links to the
  // tab where it is filled in.
  const cvChecklist: { key: CvSectionKey; label: string; filled: boolean; tab: TabKey }[] = profile
    ? [
        { key: "profile", label: "Profile summary", filled: !!profile.customExperienceText, tab: "personal" },
        { key: "skills", label: "Skills", filled: profile.skills.length > 0, tab: "personal" },
        { key: "languages", label: "Languages", filled: profile.languages.length > 0, tab: "personal" },
        { key: "references", label: "References", filled: profile.references.length > 0, tab: "references" },
        { key: "experience", label: "Experience", filled: (employment?.length ?? 0) > 0, tab: "education" },
        { key: "certificates", label: "Certificates", filled: profile.certificates.length > 0, tab: "personal" },
        { key: "education", label: "Education", filled: profile.education.length > 0, tab: "education" },
      ]
    : [];

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("Log in to see your account settings.")}</p>
      </div>
    );
  }

  return (
    // w-full alongside max-w-5xl/mx-auto isn't redundant here — body is a
    // column flex container (layout.tsx), and a block child's cross-axis
    // stretch inside a flex-column parent doesn't reliably fill the
    // available width before max-width is applied, so without w-full this
    // shrinks to whatever the current tab's content happens to need. That's
    // what was making the sidebar visibly jump left/right when switching
    // tabs — each tab's card content has a different natural width.
    <div className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10">
      <h1 className="mb-8 text-4xl leading-tight text-foreground">{t("Your account")}</h1>

      {profile === null ? (
        error ? (
          <div className="rounded-2xl bg-surface shadow-xs p-5">
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            <Link href="/" className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400">
              &larr; {t("Back home")}
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("Loading...")}</p>
        )
      ) : (
        <SidebarContentRow>
          <SettingsNav
            label="Profile sections"
            items={profileTabsFor(role === "COMPANY_OWNER")}
            active={activeTab}
            onChange={setActiveTab}
          />

          <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-6">
          {activeTab === "customize" && (
          <>
          {/* Avatar, real name + chosen username preview, background, username picker */}
          <div className="rounded-2xl bg-surface shadow-xs p-5">
            <div className="mb-5 flex items-center gap-3">
              {/* Shows the avatar being picked, before it is saved. */}
              <Avatar
                avatarKey={avatarKey}
                avatarGradient={avatarGradient}
                photoUrl={role === "COMPANY_OWNER" ? employerProfile?.profilePictureUrl : null}
                size="md"
              />
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-base font-bold text-foreground">
                    {profile.firstName} {profile.lastName}
                  </p>
                  <GenderToggle
                    value={avatarGenderDraft}
                    onChange={(g) => {
                      setAvatarGenderDraft(g);
                      setAvatarKey((key) => avatarKeyForGender(key, g) ?? key);
                    }}
                  />
                </div>
                <p className="text-sm font-light text-muted-foreground">
                  {profile.reviewUsername ?? avatarLabel(profile.avatarKey) ?? t("Anonymous")}
                </p>
              </div>
            </div>

            <AvatarEditor
              avatarKey={avatarKey}
              avatarGradient={avatarGradient}
              onChangeAvatarKey={setAvatarKey}
              onChangeGradient={setAvatarGradient}
              workType={workTypeDraft}
              gender={avatarGenderDraft}
              onChangeGender={setAvatarGenderDraft}
            />

            {/* One box, in this order: avatar (above), username, and for a
                company owner their own picture in place of the avatar. */}
                <p className="mb-1 mt-6 text-[13px] font-semibold text-foreground">{t("Username")}</p>
                <p className="mb-2 text-xs text-muted-foreground">
                  {role === "COMPANY_OWNER"
                    ? t("Your anonymous name on the site - pick whichever one you like. As a company owner, the top of the site always shows your real name.")
                    : t("Shown on your own reviews instead of your real name - pick whichever one you like.")}
                </p>
                <SingleSelectDropdown
                  value={reviewUsername}
                  onChange={(v) => v && setReviewUsername(v)}
                  placeholder={t("Choose a username")}
                  clearable={false}
                  searchable={false}
                  maxHeightClassName="max-h-none"
                  options={usernameOptions}
                />
            {role !== "COMPANY_OWNER" && (
              <>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("Want a one-off random name instead, for a single review? You can turn that on at the end of the review itself, when you submit or edit it.")}
                </p>

                <label className="mb-3 mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={showUsernameDraft}
                    onChange={(e) => setShowUsernameDraft(e.target.checked)}
                  />
                  <span>
                    {t("Show my username in the top-right corner")}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t("The corner of the site then shows the username above instead of your name (the display name from My CV). Only you see that corner - your CV keeps your name.")}
                    </span>
                  </span>
                </label>
              </>
            )}

            {role === "COMPANY_OWNER" && employerProfile && (
              <div className="mt-6 border-t border-border pt-5">
                <p className="mb-1 text-[13px] font-semibold text-foreground">{t("Use your own picture instead of avatar")}</p>
                <p className="mb-4 text-xs text-muted-foreground">
                  {t("Shown instead of your avatar wherever you appear under your real name as a verified company owner, until you remove it with the X. It is saved as soon as you pick it. Your anonymous avatar and username stay on anything you post anonymously.")}
                </p>
                <AvatarPhotoUploader
                  value={employerProfile.profilePictureUrl}
                  onChange={(url) => {
                    setEmployerProfile((prev) => (prev ? { ...prev, profilePictureUrl: url } : prev));
                    // The header shows the photo in place of the avatar: show it there now.
                    patchOnboardingStatus({ ownerPhotoUrl: url });
                  }}
                />
              </div>
            )}

            <button
              onClick={saveCustomization}
              disabled={avatarSaving}
              className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {avatarSaving ? t("Saving...") : t("Save changes")}
            </button>
            {avatarStatus && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{avatarStatus}</p>}
            {avatarError && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{avatarError}</p>}
          </div>

          </>
          )}

          {activeTab === "personal" && (
          <>
          {/* Personal information */}
          <div className="rounded-2xl bg-surface shadow-xs p-5">
            <h2 className="mb-3 font-semibold text-foreground">{t("Personal Information")}</h2>

            <div className="text-sm">
              <p className="text-xs font-medium text-muted-foreground">{t("Name")}</p>
              <p className="text-foreground">{profile.firstName ?? "—"}</p>
            </div>

            <div className="mt-4 border-t border-border pt-4 text-sm">
              <p className="text-xs font-medium text-muted-foreground">{t("Surname")}</p>
              <p className="text-foreground">{profile.lastName ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("Name and surname can't be changed here. If either needs correcting, email")}{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 hover:underline dark:text-brand-400">
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("Location")}</p>
              <LocationPicker value={location} onChange={setLocation} disabled={!editingLocation} />
              <button
                onClick={() => {
                  if (editingLocation) {
                    void saveLocation();
                  } else {
                    setLocationStatus(null);
                    setLocationError(null);
                    setEditingLocation(true);
                  }
                }}
                disabled={locationSaving || (editingLocation && (!location.country || !location.city))}
                className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                {editingLocation ? (locationSaving ? t("Saving...") : t("Save location")) : t("Change location")}
              </button>
              {locationStatus && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{locationStatus}</p>}
              {locationError && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{locationError}</p>}
            </div>

            <div className="mt-4 border-t border-border pt-4">
              {/* Placeholder — not wired to anything yet, just here so the
                  planned field isn't forgotten. See the note below it. */}
              <p className="mb-1 text-xs font-medium text-muted-foreground">T.C. Kimlik No</p>
              <input
                disabled
                placeholder={t("Coming soon")}
                className="w-full cursor-not-allowed rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground opacity-60"
              />
            </div>


            <div className="mt-4 border-t border-border pt-4 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("Birth date")}</p>
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
                      {birthDateSaving ? t("Saving...") : t("Save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingBirthDate(false)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                    >
                      {t("Cancel")}
                    </button>
                  </div>
                  {birthDateError && <p className="text-sm text-red-600 dark:text-red-300">{birthDateError}</p>}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-foreground">{formatDate(profile.birthDate, locale) || "—"}</p>
                  <button
                    type="button"
                    onClick={startEditBirthDate}
                    className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {t("Edit")}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <p className="text-xs font-medium text-muted-foreground">{t("Languages")}</p>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {profile.languages.length} / {MAX_LANGUAGES_PER_MEMBER}
                </span>
              </div>
              <div className="max-w-xs">
                <SingleSelectDropdown
                  value={null}
                  onChange={(code) => {
                    if (code) void saveLanguages([...profile.languages, code]);
                  }}
                  options={LANGUAGES.filter((l) => !profile.languages.includes(l.code)).map((l) => ({
                    value: l.code,
                    label: languageName(l.code, l.label, locale),
                  }))}
                  placeholder={
                    profile.languages.length >= MAX_LANGUAGES_PER_MEMBER
                      ? t("Remove one to add another")
                      : t("Add a language you know")
                  }
                  ariaLabel={t("Add a language you know")}
                  clearable={false}
                  disabled={profile.languages.length >= MAX_LANGUAGES_PER_MEMBER}
                />
              </div>
              {profile.languages.length > 0 ? (
                <ul aria-label={t("Your languages")} className="mt-3 flex flex-wrap gap-1.5">
                  {profile.languages.map((code) => (
                    <li key={code}>
                      <button
                        type="button"
                        onClick={() => void saveLanguages(profile.languages.filter((c) => c !== code))}
                        title={t("Remove {name}", { name: languageName(code, languageLabel(code), locale) })}
                        aria-label={t("Remove {name}", { name: languageName(code, languageLabel(code), locale) })}
                        className="group flex items-center gap-1.5 rounded-full bg-brand-600 py-1 pl-3 pr-2 text-xs font-semibold text-white transition hover:bg-brand-700"
                      >
                        {languageName(code, languageLabel(code), locale)}
                        <svg viewBox="0 0 24 24" className="h-3 w-3 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">{t("None added yet.")}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{t("Saved as you pick, and shown on your CV.")}</p>
              {languagesError && <p className="mt-1 text-sm text-red-600 dark:text-red-300">{languagesError}</p>}
            </div>

            {role !== "COMPANY_OWNER" && (
              <div className="mt-4 border-t border-border pt-4">
                <CertificatesSection
                  certificates={profile.certificates}
                  onChange={(certificates) => setProfile((p) => (p ? { ...p, certificates } : p))}
                />
              </div>
            )}

            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t("What kind of work?")}</p>
              <WorkTypePicker value={workTypeDraft} onChange={handleWorkTypeChange} />
            </div>

            <AnimatePresence>
              {workTypeDraft && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
                  className="mt-4 overflow-hidden border-t border-border pt-4"
                >
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t("Sector")}</p>
                  <select
                    value={sectorIdDraft ?? ""}
                    onChange={(e) => setSectorIdDraft(e.target.value || null)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  >
                    <option value="">{t("Select a sector...")}</option>
                    {sectors
                      .filter((s) => sectorAppliesTo(s, workTypeDraft))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {t(s.label)}
                        </option>
                      ))}
                  </select>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-4 border-t border-border pt-4">
              <SkillsPicker selectedIds={skillIdsDraft} onChange={setSkillIdsDraft} />
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <label className="text-sm font-medium text-foreground">{t("Information")}</label>
              <p className="text-xs text-muted-foreground">
                {t("For an employer not in the list on your Education & Work History tab: free text, up to 2000 characters. Shown on your CV.")}
              </p>
              <textarea
                maxLength={2000}
                rows={6}
                value={customExperienceDraft}
                onChange={(e) => setCustomExperienceDraft(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={savePersonalWorkInfo}
              disabled={personalSaving}
              className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {personalSaving ? t("Saving...") : t("Save")}
            </button>
            {personalStatus && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{personalStatus}</p>}
            {personalError && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{personalError}</p>}
          </div>
          </>
          )}

          {activeTab === "contact" && (
          <>
          {/* Contact information */}
          <div className="rounded-2xl bg-surface shadow-xs p-5">
            <h2 className="mb-3 font-semibold text-foreground">{t("Contact Information")}</h2>

            <div className="text-sm">
              <p className="text-xs font-medium text-muted-foreground">{t("E-Mail Address")}</p>
              <p className="text-foreground">{profile.email ?? "—"}</p>
            </div>

            <div className="mt-4 border-t border-border pt-4 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("Verified phone number")}</p>
              {editingPhone ? (
                <div className="flex flex-col gap-2">
                  {phoneStage === "phone" ? (
                    <>
                      <PhoneNumberInput value={phoneDraft} onChange={setPhoneDraft} />
                      <p className="text-xs text-muted-foreground">
                        {t("We'll text a 6-digit code to confirm you control this number before it replaces your current one.")}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {t("We sent a 6-digit code to {phone}. It expires in 5 minutes.", { phone: phoneDraft })}
                      </p>
                      {phoneDevCode && (
                        <p className="rounded-lg border border-dashed border-brand-300 bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-300">
                          No SMS provider is configured yet — dev mode code:{" "}
                          <span className="font-semibold">{phoneDevCode}</span>
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
                          ? t("Sending...")
                          : t("Verifying...")
                        : phoneStage === "phone"
                          ? t("Send code")
                          : t("Verify")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPhone(false)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                    >
                      {t("Cancel")}
                    </button>
                  </div>
                  {phoneError && <p className="text-sm text-red-600 dark:text-red-300">{phoneError}</p>}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-foreground">{profile.phoneNumber ?? "—"}</p>
                  <button
                    type="button"
                    onClick={startEditPhone}
                    className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {t("Edit")}
                  </button>
                </div>
              )}
            </div>

            <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
              {t("We're not collecting a T.C. Kimlik No yet. For now, your phone number verified by SMS/OTP is what confirms your account. When that's added, it'll be from this page, used once, then removed. We never hold on to national ID numbers.")}
            </p>
          </div>
          </>
          )}

          {activeTab === "education" && (
          <>
          {/* Education */}
          <div className="rounded-2xl bg-surface shadow-xs p-5">
            <h2 className="mb-3 font-semibold text-foreground">{t("Education")}</h2>
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
                              {t(l.label)}
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
                          placeholder={t("Year")}
                          className="col-span-2 rounded-lg border border-border bg-surface-muted px-2 py-1.5 text-xs text-foreground"
                        />
                      </div>
                      {editEduLevel === "COLLEGE" && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={editEduFaculty}
                            onChange={(ev) => setEditEduFaculty(ev.target.value)}
                            placeholder={t("Faculty")}
                            className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                          />
                          <input
                            value={editEduDepartment}
                            onChange={(ev) => setEditEduDepartment(ev.target.value)}
                            placeholder={t("Department (optional)")}
                            className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                          />
                        </div>
                      )}
                      {editEduLevel === "HIGH_SCHOOL" && (
                        <input
                          value={editEduDepartment}
                          onChange={(ev) => setEditEduDepartment(ev.target.value)}
                          placeholder={t("Department (optional)")}
                          className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                        />
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={saveEditEducation}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                        >
                          {t("Save")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingEduId(null)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                        >
                          {t("Cancel")}
                        </button>
                      </div>
                    </li>
                  ) : (
                    <li key={e.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        {e.institutionName}{" "}
                        <span className="text-muted-foreground">
                          · {t(eduLevelLabel(e.level))}
                          {e.graduationYear ? ` · ${t("Class of {year}", { year: e.graduationYear })}` : ""}
                          {e.faculty ? ` · ${e.faculty}` : ""}
                          {e.department ? ` · ${e.department}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-2 text-xs">
                        <button type="button" onClick={() => startEditEducation(e)} className="text-brand-600 hover:underline dark:text-brand-400">
                          {t("Edit")}
                        </button>
                        <button type="button" onClick={() => deleteEducation(e.id)} className="text-red-600 hover:underline dark:text-red-300">
                          {t("Remove")}
                        </button>
                      </span>
                    </li>
                  ),
                )}
              </ul>
            )}
            {eduError && <p className="mb-2 text-sm text-red-600 dark:text-red-300">{eduError}</p>}
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
                        {t(l.label)}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder={t("Institution name")}
                    value={newEduInstitution}
                    onChange={(e) => setNewEduInstitution(e.target.value)}
                    className="col-span-4 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                  />
                  <input
                    placeholder={t("Grad. year")}
                    inputMode="numeric"
                    value={newEduYear}
                    onChange={(e) => setNewEduYear(e.target.value)}
                    className="col-span-2 rounded-lg border border-border bg-surface-muted px-2 py-1.5 text-xs text-foreground"
                  />
                </div>
                {newEduLevel === "COLLEGE" && newEduInstitution.trim() !== "" && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder={t("Faculty")}
                      value={newEduFaculty}
                      onChange={(e) => setNewEduFaculty(e.target.value)}
                      className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                    />
                    <input
                      placeholder={t("Department (optional)")}
                      value={newEduDepartment}
                      onChange={(e) => setNewEduDepartment(e.target.value)}
                      className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                    />
                  </div>
                )}
                {newEduLevel === "HIGH_SCHOOL" && newEduInstitution.trim() !== "" && (
                  <input
                    placeholder={t("Department (optional)")}
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
                    {addingEdu ? t("Adding...") : t("Add")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddEdu(false)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                  >
                    {t("Cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddEdu(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                + {t("Add education")}
              </button>
            )}
          </div>

          {/* Employment history */}
          <div className="rounded-2xl bg-surface shadow-xs p-5">
            <h2 className="mb-1 font-semibold text-foreground">{t("Employment history")}</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              {t("Pick a real workplace from the list below: no free typing, same as everywhere else on this page. Entries you've already reviewed can't be changed or removed.")}
            </p>
            {employment === null && <p className="text-sm text-muted-foreground">{t("Loading...")}</p>}
            {employment !== null && employment.length === 0 && (
              <p className="mb-3 text-sm text-muted-foreground">{t("Nothing on file yet.")}</p>
            )}
            <ul className="mb-3 flex flex-col gap-2">
              {employment?.map((e) =>
                editingJobId === e.id ? (
                  <li key={e.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-foreground">{e.rawCompanyName}</p>
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-muted-foreground">{t("Job title (optional)")}</p>
                      <input
                        placeholder={t("e.g. Software Engineer")}
                        value={editJobTitle}
                        onChange={(ev) => setEditJobTitle(ev.target.value)}
                        className="w-full rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="mb-1 text-[11px] font-medium text-muted-foreground">{t("Start date")}</p>
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
                          {t("End date")} {!editJobStart && t("- pick a start date first")}
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
                        {t("Save")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingJobId(null)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                      >
                        {t("Cancel")}
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
                      {e.jobTitle && <span className="text-muted-foreground"> &middot; {e.jobTitle}</span>}
                      {(e.startDate || e.endDate) && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {e.startDate ?? "?"} - {e.endDate ?? t("present")}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs">
                      {e.hasReview ? (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                          {t("Reviewed")}
                        </span>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEditEmployment(e)} className="text-brand-600 hover:underline dark:text-brand-400">
                            {t("Edit")}
                          </button>
                          <button type="button" onClick={() => deleteEmployment(e.id)} className="text-red-600 hover:underline dark:text-red-300">
                            {t("Remove")}
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                ),
              )}
            </ul>
            {jobError && <p className="mb-2 text-sm text-red-600 dark:text-red-300">{jobError}</p>}

            {showAddJob ? (
              <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <WorkplacePicker onPick={setNewJobCompany} />
                {newJobCompany && (
                  <p className="text-xs text-muted-foreground">
                    {t("Selected:")} <span className="font-medium text-foreground">{newJobCompany.name}</span>
                  </p>
                )}
                <div>
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">{t("Job title (optional)")}</p>
                  <input
                    placeholder={t("e.g. Software Engineer")}
                    value={newJobTitle}
                    onChange={(e) => setNewJobTitle(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">{t("Start date")}</p>
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
                    {t("End date (leave blank if current)")} {!newJobStart && t("- pick a start date first")}
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
                    {addingJob ? t("Adding...") : t("Add workplace")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddJob(false)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                  >
                    {t("Cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddJob(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                + {t("Add workplace")}
              </button>
            )}
          </div>
          </>
          )}

          {activeTab === "references" && role !== "COMPANY_OWNER" && (
            <ReferencesPanel
              references={profile.references}
              onChange={(references) => setProfile((p) => (p ? { ...p, references } : p))}
            />
          )}

          {activeTab === "ratings" && role !== "COMPANY_OWNER" && <MyRatingsPanel />}

          {activeTab === "cv" && (
          <>
          <div className="rounded-2xl bg-surface p-5 shadow-xs sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">{t("My CV")}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("Built from your profile. This is what an employer receives when you press Apply.")}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCvFullscreen(true)}
                  aria-label={t("View CV fullscreen")}
                  className="flex items-center gap-1.5 rounded-lg bg-surface-muted px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-border/60"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
                  </svg>
                  {t("Full screen")}
                </button>
                <button
                  type="button"
                  onClick={() => void downloadCv()}
                  disabled={cvDownloading}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
                  </svg>
                  {cvDownloading ? t("Preparing...") : t("Download PDF")}
                </button>
              </div>
            </div>
            {cvDownloadError && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{cvDownloadError}</p>}

            <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
              {/* Left: who the CV is from */}
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cv-display-name" className="text-xs font-semibold text-foreground">
                    {t("Display name")}
                  </label>
                  <input
                    id="cv-display-name"
                    type="text"
                    maxLength={80}
                    value={displayNameDraft}
                    onChange={(e) => setDisplayNameDraft(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("Optional. Shown on your CV and in the site header instead of your anonymous handle (unless you ticked “Show my username in the top-right corner” on Customize). Your reviews always stay under your anonymous handle regardless of this setting.")}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-foreground">{t("CV photo")}</p>
                  <div className="flex items-start gap-4">
                    <AvatarPhotoUploader
                      target="cv"
                      value={profile.cvPhotoUrl}
                      onChange={(url) => setProfile((p) => (p ? { ...p, cvPhotoUrl: url } : p))}
                    />
                    <p className="rounded-lg bg-surface-muted/70 px-3 py-2 text-xs text-muted-foreground">
                      {t("Your photo is only shown on the CV that is sent to the jobs you apply for. It never appears anywhere else on the site: your reviews and comments keep your anonymous avatar.")}
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={isPublicEmployeeDraft}
                    onChange={(e) => setIsPublicEmployeeDraft(e.target.checked)}
                  />
                  {t("I am a public sector employee")}
                </label>
              </div>

              {/* Right: what goes on it */}
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-xs font-semibold text-foreground">{t("Contact details on my CV")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("Off by default: your email and phone number are never sent to an employer unless you turn these on yourself.")}
                  </p>
                  <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={showEmailOnCv} onChange={(e) => toggleShowEmailOnCv(e.target.checked)} />
                    {t("Include my email on my CV")}
                  </label>
                  <label className="mt-1 flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={showPhoneOnCv} onChange={(e) => toggleShowPhoneOnCv(e.target.checked)} />
                    {t("Include my phone number on my CV")}
                  </label>
                </div>

                <div>
                  <p className="text-xs font-semibold text-foreground">{t("What's on your CV")}</p>
                  <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2">
                    {cvChecklist.map((item) => {
                      const on = item.filled && !hiddenCvSections.includes(item.key);
                      return (
                        <li key={item.key} className="group flex items-center gap-1 rounded-lg pr-1 transition hover:bg-surface-muted">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            disabled={!item.filled}
                            onClick={() => toggleCvSection(item.key)}
                            title={item.filled ? (on ? t("Shown on your CV - press to leave it out") : t("Left out of your CV - press to show it")) : undefined}
                            className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-left text-sm disabled:cursor-default"
                          >
                            <span
                              aria-hidden="true"
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] transition ${
                                on ? "bg-brand-600 text-white" : item.filled ? "bg-surface ring-1 ring-inset ring-border" : "border border-dashed border-border"
                              }`}
                            >
                              {on && (
                                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                                </svg>
                              )}
                            </span>
                            <span className={`min-w-0 ${on ? "text-foreground" : "text-muted-foreground"} ${item.filled && !on ? "line-through decoration-muted-foreground/50" : ""}`}>
                              {t(item.label)}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab(item.tab)}
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs text-brand-600 transition hover:underline dark:text-brand-400 ${
                              item.filled ? "opacity-0 group-hover:opacity-100 focus-visible:opacity-100" : ""
                            }`}
                          >
                            {item.filled ? t("Edit") : t("Add")}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/70 pt-5">
              <button
                type="button"
                onClick={saveCv}
                disabled={cvSaving}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
              >
                {cvSaving ? t("Saving...") : t("Save CV")}
              </button>
              {cvStatus && <p className="text-sm text-green-700 dark:text-green-400">{cvStatus}</p>}
              {cvError && <p className="text-sm text-red-600 dark:text-red-300">{cvError}</p>}
            </div>
          </div>

          {/* The CV itself, as large as the column allows. */}
          <div className="rounded-2xl bg-surface-muted/70 p-3 sm:p-6">
            <div className="mx-auto max-w-[52rem]">
              <CvPage>
                <CvPreview profile={cvProfile ?? profile} employment={employment ?? undefined} showEmail={showEmailOnCv} showPhone={showPhoneOnCv} hiddenSections={hiddenCvSections} />
              </CvPage>
            </div>
          </div>

          {cvFullscreen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("My CV")}
              className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-10 backdrop-blur-sm"
              onClick={() => setCvFullscreen(false)}
            >
              <div className="relative mx-auto w-full max-w-[52rem]" onClick={(e) => e.stopPropagation()}>
                <div className="mb-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void downloadCv()}
                    disabled={cvDownloading}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
                  >
                    {cvDownloading ? t("Preparing...") : t("Download PDF")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCvFullscreen(false)}
                    aria-label={t("Close")}
                    className="rounded-lg bg-white/10 p-1.5 text-white transition hover:bg-white/20"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div>
                  <CvPage>
                    <CvPreview profile={cvProfile ?? profile} employment={employment ?? undefined} showEmail={showEmailOnCv} showPhone={showPhoneOnCv} hiddenSections={hiddenCvSections} />
                  </CvPage>
                </div>
              </div>
            </div>
          )}
          {/* Full-size copy, off screen, only while a PDF is being made. */}
          {cvDownloading && (
            <div style={{ position: "fixed", left: "-9999px", top: 0 }} aria-hidden="true">
              <div ref={cvPrintRef}>
                <CvPreview profile={cvProfile ?? profile} employment={employment ?? undefined} showEmail={showEmailOnCv} showPhone={showPhoneOnCv} hiddenSections={hiddenCvSections} />
              </div>
            </div>
          )}
          </>
          )}

          {activeTab === "security" && <ChangePasswordForm />}

          {activeTab === "account" && <AccountOptionsPanel email={profile.email} />}
        </div>
          </div>
        </SidebarContentRow>
      )}
    </div>
  );
}
