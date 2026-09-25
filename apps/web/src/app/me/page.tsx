"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ANONYMOUS_USERNAMES_BY_WORKPLACE_TYPE,
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
import { avatarLabel } from "@/lib/avatars";
import { getCvShowEmail, getCvShowPhone, markCvSaved, setCvShowEmail, setCvShowPhone } from "@/lib/cvDisclosurePrefs";
import { Avatar } from "@/components/Avatar";
import { AvatarEditor } from "@/components/AvatarEditor";
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
import { CvPreview } from "@/components/profile/CvPreview";
import { SidebarContentRow } from "@/components/layout/SidebarShell";
import { SettingsNav } from "@/components/layout/SettingsNav";
import { ConversationInbox } from "@/components/messaging/ConversationInbox";
import { profileTabsFor, type ProfileTabKey } from "@/components/profile/profileTabs";
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";

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

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// useSearchParams (the ?tab= / ?c= deep links) needs a Suspense boundary so
// the page can still be prerendered; the inner component does the work.
export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilePageContent />
    </Suspense>
  );
}

function ProfilePageContent() {
  const { isAuthenticated, isLoading: authLoading, refreshOnboardingStatus, role } = useAuth();
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
  const searchParams = useSearchParams();

  // Lets ApplyButton.tsx's CV gate land a member directly on this tab
  // (`/me?tab=cv`), and a message notification on the Messages tab
  // (`/me?tab=messages&c=...`), instead of the default "Customize" tab.
  // Re-runs when the URL's query changes (a notification clicked while
  // already on /me doesn't remount the page); tab clicks are pure client
  // state and don't touch the URL, so they never retrigger this.
  const tabParam = searchParams.get("tab");
  const conversationParam = searchParams.get("c");
  // Owners have no Messages tab (their messages live in the company dashboard).
  const isCompanyOwner = useIsCompanyOwner();
  const tabs = profileTabsFor(isCompanyOwner);
  useEffect(() => {
    if (profileTabsFor(isCompanyOwner).some((t) => t.key === tabParam)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing tab state from the URL
      setActiveTab(tabParam as TabKey);
    }
  }, [tabParam, conversationParam, isCompanyOwner]);

  // Local editable form state, seeded from the loaded profile.
  const [reviewUsername, setReviewUsername] = useState<string | null>(null);
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [avatarGradient, setAvatarGradient] = useState<string | null>(null);
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
      setAvatarGradient(profileData.avatarGradient);
      setLocation({ country: profileData.country, city: profileData.city, district: profileData.district });
      setEditingLocation(!profileData.country || !profileData.city);
      setDisplayNameDraft(profileData.displayName ?? "");
      setIsPublicEmployeeDraft(profileData.isPublicEmployee);
      setCustomExperienceDraft(profileData.customExperienceText ?? "");
      setWorkTypeDraft(profileData.workType);
      setSectorIdDraft(profileData.sector?.id ?? null);
      setSkillIdsDraft(profileData.skills.map((s) => s.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your profile.");
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
  }, []);

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
      // reviewUsername is only ever included for a non-owner: the API
      // rejects any attempt to change it from a COMPANY_OWNER (2026-09-11),
      // including a harmless resend of the same value, so omitting the key
      // entirely here is what lets an owner save their avatar at all.
      await apiPatch("/me/profile", {
        avatarKey,
        avatarGradient,
        ...(role === "COMPANY_OWNER" ? {} : { reviewUsername }),
      });
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
      setLocationStatus("Saved.");
      setEditingLocation(false);
    } catch (err) {
      setLocationError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setLocationSaving(false);
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
      setCvStatus("Saved.");
    } catch (err) {
      setCvError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setCvSaving(false);
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
      setPersonalStatus("Saved.");
    } catch (err) {
      setPersonalError(err instanceof ApiError ? err.message : "Couldn't save changes.");
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
      const result = await apiPost<{ devCode?: string }>("/me/phone/request-otp", { phoneNumber: phoneDraft });
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
      await apiPost("/me/phone/verify-otp", { code: phoneOtpCode });
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
    if (newEduLevel === "COLLEGE" && !newEduFaculty.trim()) {
      setEduError("Faculty is required for a College entry.");
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
    if (editEduLevel === "COLLEGE" && !editEduFaculty.trim()) {
      setEduError("Faculty is required for a College entry.");
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
      setEduError(err instanceof ApiError ? err.message : "Couldn't save that.");
    }
  }

  async function deleteEducation(id: string) {
    setEduError(null);
    try {
      await apiDelete(`/me/education-history/${id}`);
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
      setJobError(err instanceof ApiError ? err.message : "Couldn't add that.");
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
      setJobError(err instanceof ApiError ? err.message : "Couldn't save that.");
    }
  }

  async function deleteEmployment(id: string) {
    setJobError(null);
    try {
      await apiDelete(`/me/employment-history/${id}`);
      setEmployment((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
    } catch (err) {
      setJobError(err instanceof ApiError ? err.message : "Couldn't remove that.");
    }
  }

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Log in to see your account settings.</p>
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
      <h1 className="mb-6 text-2xl font-bold text-foreground">Your account</h1>

      {profile === null ? (
        error ? (
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            <Link href="/" className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400">
              &larr; Back home
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )
      ) : (
        <SidebarContentRow>
          <SettingsNav label="Profile sections" items={tabs} active={activeTab} onChange={setActiveTab} />

          <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-6">
          {activeTab === "customize" && (
          <>
          {/* Avatar, real name + chosen username preview, background, username picker */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center gap-3">
              <Avatar avatarKey={profile.avatarKey} avatarGradient={profile.avatarGradient} size="md" />
              <div>
                <p className="text-base font-bold text-foreground">
                  {profile.firstName} {profile.lastName}
                </p>
                <p className="text-sm font-light text-muted-foreground">
                  {profile.reviewUsername ?? avatarLabel(profile.avatarKey) ?? "Anonymous"}
                </p>
              </div>
            </div>

            <AvatarEditor
              avatarKey={avatarKey}
              avatarGradient={avatarGradient}
              onChangeAvatarKey={setAvatarKey}
              onChangeGradient={setAvatarGradient}
              workType={workTypeDraft}
              showWorkTypePicker={false}
            />

            {/* Company owners keep whatever anonymous username they already
                have - restricted to avatar (above) and their real employer
                photo (below) only, per 2026-09-11 product decision. */}
            {role !== "COMPANY_OWNER" && (
              <>
                <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Username</p>
                <p className="mb-2 text-xs text-muted-foreground">
                  Shown on your own reviews instead of your real name — pick whichever one you like.
                </p>
                <SingleSelectDropdown
                  value={reviewUsername}
                  onChange={(v) => v && setReviewUsername(v)}
                  placeholder="Choose a username"
                  clearable={false}
                  searchable={false}
                  maxHeightClassName="max-h-none"
                  options={usernameOptions}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Want a one-off random name instead, for a single review? You can turn that on at the end of the review
                  itself, when you submit or edit it.
                </p>
              </>
            )}

            <button
              onClick={saveCustomization}
              disabled={avatarSaving}
              className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {avatarSaving ? "Saving..." : "Save changes"}
            </button>
            {avatarStatus && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{avatarStatus}</p>}
            {avatarError && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{avatarError}</p>}
          </div>

          {role === "COMPANY_OWNER" && employerProfile && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-1 font-semibold text-foreground">Employer Photo</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Shown alongside your real name wherever you appear as a verified company owner — separate from the
                anonymous avatar/username above, which is still yours to use if you ever review a different company.
              </p>
              <AvatarPhotoUploader
                value={employerProfile.profilePictureUrl}
                onChange={(url) => setEmployerProfile((prev) => (prev ? { ...prev, profilePictureUrl: url } : prev))}
              />
            </div>
          )}
          </>
          )}

          {activeTab === "personal" && (
          <>
          {/* Personal information */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-semibold text-foreground">Personal Information</h2>

            <div className="text-sm">
              <p className="text-xs font-medium text-muted-foreground">Name</p>
              <p className="text-foreground">{profile.firstName ?? "—"}</p>
            </div>

            <div className="mt-4 border-t border-border pt-4 text-sm">
              <p className="text-xs font-medium text-muted-foreground">Surname</p>
              <p className="text-foreground">{profile.lastName ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Name and surname can&apos;t be changed here — email{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 hover:underline dark:text-brand-400">
                  {SUPPORT_EMAIL}
                </a>{" "}
                if either needs correcting.
              </p>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Location</p>
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
                {editingLocation ? (locationSaving ? "Saving..." : "Save location") : "Change location"}
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
                placeholder="Coming soon"
                className="w-full cursor-not-allowed rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground opacity-60"
              />
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
                  {birthDateError && <p className="text-sm text-red-600 dark:text-red-300">{birthDateError}</p>}
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

            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">What kind of work?</p>
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
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Sector</p>
                  <select
                    value={sectorIdDraft ?? ""}
                    onChange={(e) => setSectorIdDraft(e.target.value || null)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  >
                    <option value="">Select a sector...</option>
                    {sectors
                      .filter((s) => sectorAppliesTo(s, workTypeDraft))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
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
              <label className="text-sm font-medium text-foreground">Information</label>
              <p className="text-xs text-muted-foreground">
                For an employer not in the list on your Education & Work History tab — free text, up to 2000
                characters. Shown on your CV.
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
              {personalSaving ? "Saving..." : "Save"}
            </button>
            {personalStatus && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{personalStatus}</p>}
            {personalError && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{personalError}</p>}
          </div>
          </>
          )}

          {activeTab === "contact" && (
          <>
          {/* Contact information */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-semibold text-foreground">Contact Information</h2>

            <div className="text-sm">
              <p className="text-xs font-medium text-muted-foreground">E-Mail Address</p>
              <p className="text-foreground">{profile.email ?? "—"}</p>
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
          </>
          )}

          {activeTab === "education" && (
          <>
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
                        <button type="button" onClick={() => deleteEducation(e.id)} className="text-red-600 hover:underline dark:text-red-300">
                          Remove
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
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-muted-foreground">Job title (optional)</p>
                      <input
                        placeholder="e.g. Software Engineer"
                        value={editJobTitle}
                        onChange={(ev) => setEditJobTitle(ev.target.value)}
                        className="w-full rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                      />
                    </div>
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
                      {e.jobTitle && <span className="text-muted-foreground"> &middot; {e.jobTitle}</span>}
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
                          <button type="button" onClick={() => deleteEmployment(e.id)} className="text-red-600 hover:underline dark:text-red-300">
                            Remove
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
                    Selected: <span className="font-medium text-foreground">{newJobCompany.name}</span>
                  </p>
                )}
                <div>
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">Job title (optional)</p>
                  <input
                    placeholder="e.g. Software Engineer"
                    value={newJobTitle}
                    onChange={(e) => setNewJobTitle(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  />
                </div>
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
          </>
          )}

          {activeTab === "cv" && (
          <>
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-semibold text-foreground">My CV</h2>
            <div className="flex flex-col gap-6 sm:flex-row">
              <div className="flex-1 flex flex-col gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Display name</label>
                  <p className="text-xs text-muted-foreground">
                    Optional. Shown on your CV and in the site header instead of your anonymous handle — your reviews
                    always stay under your anonymous handle regardless of this setting.
                  </p>
                  <input
                    type="text"
                    maxLength={80}
                    value={displayNameDraft}
                    onChange={(e) => setDisplayNameDraft(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isPublicEmployeeDraft}
                    onChange={(e) => setIsPublicEmployeeDraft(e.target.checked)}
                  />
                  I am a public sector employee
                </label>
                <div>
                  <p className="text-sm font-medium text-foreground">Contact details on my CV</p>
                  <p className="text-xs text-muted-foreground">
                    Off by default — your email and phone number are never sent to an employer unless you turn
                    these on yourself.
                  </p>
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showEmailOnCv}
                      onChange={(e) => toggleShowEmailOnCv(e.target.checked)}
                    />
                    Include my email on my CV
                  </label>
                  <label className="mt-1 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showPhoneOnCv}
                      onChange={(e) => toggleShowPhoneOnCv(e.target.checked)}
                    />
                    Include my phone number on my CV
                  </label>
                </div>
                <button
                  type="button"
                  onClick={saveCv}
                  disabled={cvSaving}
                  className="self-start rounded-full border border-border bg-sidebar px-4 py-2 text-sm font-bold text-sidebar-foreground transition disabled:opacity-50"
                >
                  {cvSaving ? "Saving..." : "Save CV"}
                </button>
                {cvStatus && <p className="text-sm text-green-700 dark:text-green-400">{cvStatus}</p>}
                {cvError && <p className="text-sm text-red-600 dark:text-red-300">{cvError}</p>}
              </div>
              <div className="flex-1">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">How it looks</p>
                  <button
                    type="button"
                    onClick={() => setCvFullscreen(true)}
                    title="View fullscreen"
                    aria-label="View CV fullscreen"
                    className="rounded p-1 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
                    </svg>
                  </button>
                </div>
                <CvPreview profile={profile} showEmail={showEmailOnCv} showPhone={showPhoneOnCv} />
              </div>
            </div>
          </div>
          {cvFullscreen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
              onClick={() => setCvFullscreen(false)}
            >
              <div className="relative max-h-full w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setCvFullscreen(false)}
                  aria-label="Close"
                  className="absolute -top-10 right-0 rounded-full p-1 text-white transition hover:bg-white/10"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
                <CvPreview profile={profile} showEmail={showEmailOnCv} showPhone={showPhoneOnCv} forPrint />
              </div>
            </div>
          )}
          </>
          )}

          {activeTab === "messages" && !isCompanyOwner && (
            <section className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-1 font-semibold text-foreground">Messages</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Private conversations with companies that replied to your reviews. They only ever see your
                review name, never your account.
              </p>
              <ConversationInbox
                key={conversationParam ?? "inbox"}
                mode="reviewer"
                initialConversationId={conversationParam}
              />
            </section>
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
