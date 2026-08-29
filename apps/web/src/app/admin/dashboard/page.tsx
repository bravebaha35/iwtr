"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AdminCompanySummary,
  CompanyDetail,
  CompanySuggestion,
  MergeCompaniesResult,
  WorkplaceType,
} from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { CompanyLogoUploader } from "@/components/CompanyLogoUploader";
import { SingleSelectDropdown, type DropdownOption } from "@/components/Dropdown";
import { MultiFilterPillGroup } from "@/components/FilterPillGroup";
import { TurkishPhoneInput } from "@/components/TurkishPhoneInput";
import { TURKEY_PROVINCES, findProvinceByCityName } from "@/lib/turkeyGeo";
import { WORKPLACE_TYPES } from "@/lib/workplaceTypes";
import { sectorsForWorkplaceTypes } from "@/lib/sectors";

// Real server-side protection for everything on this page is `proxy.ts`
// (redirects a non-admin away before this even renders) plus, independently,
// every /admin/companies/* route's own RolesGuard (a 403 no matter what the
// frontend does). This client-side `isAuthenticated` gate below is only
// about not flashing the dashboard shell for a moment before that redirect
// lands — same pattern as the existing /admin/moderation and
// /admin/owner-claims pages.

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold text-foreground">{title}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      {label} {required && <span className="text-red-600 dark:text-red-400">(required)</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function TextField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
    />
  );
}

function YesNoToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[
        { v: true, label: "Yes" },
        { v: false, label: "No" },
      ].map((opt) => (
        <button
          key={String(opt.v)}
          type="button"
          onClick={() => onChange(opt.v)}
          className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition ${
            value === opt.v
              ? "border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
              : "border-border bg-surface text-muted-foreground hover:bg-surface-muted"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Shared by both "Create New Company" and "Edit Company Data" — the exact
// same set of fields AdminCreateCompanyInput/AdminUpdateCompanyInput both
// accept, minus id/slug which don't belong on a form.
interface CompanyFormState {
  name: string;
  category: string | null;
  workplaceTypes: WorkplaceType[];
  city: string | null;
  district: string | null;
  mainPhotoUrl: string;
  taxNumber: string;
  isChainStore: boolean;
  contactEmail: string;
  contactPhone: string;
  facebookUrl: string;
  instagramUrl: string;
  whatsappUrl: string;
  xUrl: string;
  website: string;
  description: string;
}

const emptyForm: CompanyFormState = {
  name: "",
  category: null,
  workplaceTypes: [],
  city: null,
  district: null,
  mainPhotoUrl: "",
  taxNumber: "",
  isChainStore: false,
  contactEmail: "",
  contactPhone: "",
  facebookUrl: "",
  instagramUrl: "",
  whatsappUrl: "",
  xUrl: "",
  website: "",
  description: "",
};

function formFromDetail(detail: CompanyDetail): CompanyFormState {
  const c = detail.company;
  return {
    name: c.name,
    category: c.category,
    workplaceTypes: c.workplaceTypes,
    city: c.city,
    district: c.district,
    mainPhotoUrl: c.mainPhotoUrl ?? "",
    taxNumber: c.taxNumber ?? "",
    isChainStore: c.isChainStore,
    contactEmail: c.contactEmail ?? "",
    contactPhone: c.contactPhone ?? "",
    facebookUrl: c.facebookUrl ?? "",
    instagramUrl: c.instagramUrl ?? "",
    whatsappUrl: c.whatsappUrl ?? "",
    xUrl: c.xUrl ?? "",
    website: c.website ?? "",
    description: c.description ?? "",
  };
}

// The location + workplace-type + sector + logo + chain-store block is
// identical between Create and Edit — factored out so the two forms can't
// silently drift apart.
function CompanyFieldsEditor({
  form,
  setForm,
}: {
  form: CompanyFormState;
  setForm: (updater: (prev: CompanyFormState) => CompanyFormState) => void;
}) {
  const sectorOptions = useMemo(() => sectorsForWorkplaceTypes(form.workplaceTypes), [form.workplaceTypes]);
  const cityOptions: DropdownOption[] = useMemo(() => TURKEY_PROVINCES.map((p) => ({ value: p.name, label: p.name })), []);
  const province = findProvinceByCityName(form.city);
  const districtOptions: DropdownOption[] = useMemo(
    () => (province?.districts ?? []).map((d) => ({ value: d, label: d })),
    [province],
  );

  function toggleWorkplaceType(v: WorkplaceType) {
    setForm((prev) => {
      const has = prev.workplaceTypes.includes(v);
      if (has) return { ...prev, workplaceTypes: prev.workplaceTypes.filter((t) => t !== v) };
      if (prev.workplaceTypes.length >= 2) return prev;
      return { ...prev, workplaceTypes: [...prev.workplaceTypes, v] };
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Legal Name" required>
        <TextField value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Full legal company name" />
      </Field>

      <Field label="Tax Number (VKN)">
        <TextField value={form.taxNumber} onChange={(v) => setForm((p) => ({ ...p, taxNumber: v }))} placeholder="10-digit Vergi Kimlik No" />
      </Field>

      <div>
        <MultiFilterPillGroup
          heading="Work-Type (up to 2, required)"
          options={WORKPLACE_TYPES}
          selected={form.workplaceTypes}
          onToggle={(v) => toggleWorkplaceType(v as WorkplaceType)}
          onReset={() => setForm((p) => ({ ...p, workplaceTypes: [], category: null }))}
          direction="grid"
        />
      </div>

      <Field label="Sector">
        <SingleSelectDropdown
          value={form.category}
          options={sectorOptions}
          placeholder="Sector"
          onChange={(v) => setForm((p) => ({ ...p, category: v }))}
        />
      </Field>

      <Field label="Chain Store">
        <YesNoToggle value={form.isChainStore} onChange={(v) => setForm((p) => ({ ...p, isChainStore: v }))} />
      </Field>

      <Field label="Company Logo">
        <CompanyLogoUploader
          uploadPath="/admin/companies/logo"
          companyName={form.name || "Company"}
          value={form.mainPhotoUrl}
          onChange={(url) => setForm((p) => ({ ...p, mainPhotoUrl: url }))}
        />
      </Field>

      <Field label="Location">
        <div className="grid grid-cols-2 gap-2">
          <SingleSelectDropdown
            value={form.city}
            options={cityOptions}
            placeholder="Province"
            clearable={false}
            onChange={(v) => setForm((p) => ({ ...p, city: v, district: null }))}
          />
          <SingleSelectDropdown
            value={form.district}
            options={districtOptions}
            placeholder="District"
            disabled={!form.city}
            clearable={false}
            onChange={(v) => setForm((p) => ({ ...p, district: v }))}
          />
        </div>
      </Field>

      <Field label="Contact Email">
        <TextField value={form.contactEmail} onChange={(v) => setForm((p) => ({ ...p, contactEmail: v }))} placeholder="contact@company.com" />
      </Field>
      <Field label="Contact Phone">
        <TurkishPhoneInput
          value={form.contactPhone}
          onChange={(v) => setForm((p) => ({ ...p, contactPhone: v }))}
          suggestedProvince={form.city}
        />
      </Field>
      <Field label="Website">
        <TextField value={form.website} onChange={(v) => setForm((p) => ({ ...p, website: v }))} placeholder="https://..." />
      </Field>
      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          rows={3}
          className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        />
      </Field>
      <Field label="Facebook">
        <TextField value={form.facebookUrl} onChange={(v) => setForm((p) => ({ ...p, facebookUrl: v }))} placeholder="https://facebook.com/..." />
      </Field>
      <Field label="Instagram">
        <TextField value={form.instagramUrl} onChange={(v) => setForm((p) => ({ ...p, instagramUrl: v }))} placeholder="https://instagram.com/..." />
      </Field>
      <Field label="WhatsApp">
        <TextField value={form.whatsappUrl} onChange={(v) => setForm((p) => ({ ...p, whatsappUrl: v }))} placeholder="https://wa.me/..." />
      </Field>
      <Field label="X (Twitter)">
        <TextField value={form.xUrl} onChange={(v) => setForm((p) => ({ ...p, xUrl: v }))} placeholder="https://x.com/..." />
      </Field>
    </div>
  );
}

function CreateCompanySection({
  prefillName,
  onPublished,
}: {
  prefillName: string | null;
  onPublished: () => void;
}) {
  const [form, setForm] = useState<CompanyFormState>(emptyForm);
  const [fromSuggestion, setFromSuggestion] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A suggestion approved in the Pending Review Queue below prefills this
  // form's name and flags the eventual publish as an APPROVE rather than a
  // plain CREATE in AuditLog — the rest of the fields (sector, location,
  // logo) still need a human to fill in, so this deliberately doesn't
  // auto-publish. The parent remounts this whole section (via `key`) on
  // every new approval, so this only ever runs once against a fresh,
  // untouched form — never overwriting something the admin already typed.
  useEffect(() => {
    if (prefillName === null) return;
    setForm({ ...emptyForm, name: prefillName });
    setFromSuggestion(true);
  }, [prefillName]);

  const canPublish = form.name.trim().length > 0 && form.workplaceTypes.length > 0 && !submitting;

  async function publish() {
    setSubmitting(true);
    setStatus(null);
    setError(null);
    try {
      await apiPost("/admin/companies", {
        name: form.name.trim(),
        category: form.category ?? "Uncategorized",
        workplaceTypes: form.workplaceTypes,
        city: form.city ?? undefined,
        district: form.district ?? undefined,
        mainPhotoUrl: form.mainPhotoUrl.trim() || undefined,
        taxNumber: form.taxNumber.trim() || undefined,
        isChainStore: form.isChainStore,
        fromSuggestion,
      });
      setStatus(`"${form.name.trim()}" is live.`);
      setForm(emptyForm);
      setFromSuggestion(false);
      onPublished();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't publish that company.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Section title="Create New Company" description="Add a new employer profile to the directory.">
      <CompanyFieldsEditor form={form} setForm={setForm} />
      <button
        type="button"
        onClick={() => void publish()}
        disabled={!canPublish}
        className="mt-4 self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? "Publishing..." : "Publish"}
      </button>
      {status && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{status}</p>}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Section>
  );
}

function PendingSuggestionsSection({ onApprove }: { onApprove: (rawCompanyName: string) => void }) {
  const [suggestions, setSuggestions] = useState<CompanySuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actioningKey, setActioningKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSuggestions(await apiGet<CompanySuggestion[]>("/admin/companies/suggestions"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the pending queue.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function reject(s: CompanySuggestion) {
    setActioningKey(s.nameKey);
    setError(null);
    try {
      await apiPost("/admin/companies/suggestions/dismiss", { rawCompanyName: s.rawCompanyName });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't dismiss that suggestion.");
    } finally {
      setActioningKey(null);
    }
  }

  return (
    <Section
      title="Pending Review Queue"
      description="Employer names workers typed that don't match a real company yet."
    >
      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {suggestions === null && !error && <p className="text-sm text-muted-foreground">Loading...</p>}
      {suggestions !== null && suggestions.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>
      )}
      <div className="flex flex-col gap-2">
        {suggestions?.map((s) => (
          <div
            key={s.nameKey}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{s.rawCompanyName}</p>
              <p className="text-xs text-muted-foreground">
                {s.workerCount} worker{s.workerCount === 1 ? "" : "s"} typed this
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => onApprove(s.rawCompanyName)}
                disabled={actioningKey === s.nameKey}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => void reject(s)}
                disabled={actioningKey === s.nameKey}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function EditCompanySection({
  companies,
  onSaved,
}: {
  companies: AdminCompanySummary[];
  onSaved: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyFormState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options: DropdownOption[] = useMemo(
    () => companies.map((c) => ({ value: c.id, label: [c.name, c.city].filter(Boolean).join(" — ") })),
    [companies],
  );

  async function selectCompany(id: string | null) {
    setSelectedId(id);
    setForm(null);
    setStatus(null);
    setError(null);
    if (!id) return;
    const summary = companies.find((c) => c.id === id);
    if (!summary) return;
    setLoading(true);
    try {
      const detail = await apiGet<CompanyDetail>(`/companies/${summary.slug}`);
      setForm(formFromDetail(detail));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load that company.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!selectedId || !form) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      await apiPatch(`/admin/companies/${selectedId}`, {
        name: form.name.trim(),
        category: form.category ?? undefined,
        workplaceTypes: form.workplaceTypes.length > 0 ? form.workplaceTypes : undefined,
        city: form.city ?? undefined,
        district: form.district ?? undefined,
        mainPhotoUrl: form.mainPhotoUrl.trim() || undefined,
        taxNumber: form.taxNumber.trim() || undefined,
        isChainStore: form.isChainStore,
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        facebookUrl: form.facebookUrl.trim() || undefined,
        instagramUrl: form.instagramUrl.trim() || undefined,
        whatsappUrl: form.whatsappUrl.trim() || undefined,
        xUrl: form.xUrl.trim() || undefined,
        website: form.website.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      setStatus("Saved.");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save those changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Edit Company Data" description="Search for an existing company to update its details.">
      <Field label="Company">
        <SingleSelectDropdown value={selectedId} options={options} placeholder="Search by name..." onChange={(v) => void selectCompany(v)} />
      </Field>

      {loading && <p className="mt-3 text-sm text-muted-foreground">Loading...</p>}

      {form && (
        <div className="mt-4">
          <CompanyFieldsEditor form={form} setForm={setForm as (updater: (prev: CompanyFormState) => CompanyFormState) => void} />
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !form.name.trim()}
            className="mt-4 self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          {status && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{status}</p>}
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </Section>
  );
}

function MergeDuplicatesSection({
  companies,
  onMerged,
}: {
  companies: AdminCompanySummary[];
  onMerged: () => void;
}) {
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [masterId, setMasterId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  // Names are captured into the result itself, not re-derived from
  // `companies` after the merge — duplicateId/masterId get reset right
  // after a successful merge (so the dropdowns clear for the next one),
  // and the duplicate's row is gone from `companies` anyway by the time
  // onMerged()'s refetch lands, so looking either id up afterward would
  // find nothing.
  const [result, setResult] = useState<(MergeCompaniesResult & { duplicateName: string; masterName: string }) | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const options: DropdownOption[] = useMemo(
    () => companies.map((c) => ({ value: c.id, label: [c.name, c.city].filter(Boolean).join(" — ") })),
    [companies],
  );

  async function merge() {
    if (!duplicateId || !masterId) return;
    const duplicateName = companies.find((c) => c.id === duplicateId)?.name ?? "the duplicate";
    const masterName = companies.find((c) => c.id === masterId)?.name ?? "the master profile";
    setMerging(true);
    setResult(null);
    setError(null);
    try {
      const res = await apiPost<MergeCompaniesResult>("/admin/companies/merge", { duplicateId, masterId });
      setResult({ ...res, duplicateName, masterName });
      setDuplicateId(null);
      setMasterId(null);
      onMerged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't merge those companies.");
    } finally {
      setMerging(false);
    }
  }

  return (
    <Section
      title="Merge Duplicates"
      description='Fold a duplicate listing (e.g. "A101 Market") into its real master profile (e.g. "A101 Yeni Mağazacılık A.Ş.") and remove the duplicate.'
    >
      <div className="flex flex-col gap-3">
        <Field label="Duplicate (will be removed)">
          <SingleSelectDropdown value={duplicateId} options={options} placeholder="Select the duplicate..." onChange={setDuplicateId} />
        </Field>
        <Field label="Master (kept — everything moves here)">
          <SingleSelectDropdown value={masterId} options={options} placeholder="Select the master profile..." onChange={setMasterId} />
        </Field>
      </div>
      <button
        type="button"
        onClick={() => void merge()}
        disabled={merging || !duplicateId || !masterId || duplicateId === masterId}
        className="mt-4 self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {merging ? "Merging..." : "Merge"}
      </button>
      {duplicateId && masterId && duplicateId === masterId && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">Pick two different companies.</p>
      )}
      {result && (
        <p className="mt-2 text-sm text-green-700 dark:text-green-400">
          Merged {result.duplicateName} into {result.masterName}: {result.mergedReviewCount} review
          {result.mergedReviewCount === 1 ? "" : "s"} moved
          {result.droppedReviewCount > 0 &&
            ` (${result.droppedReviewCount} dropped — same reviewer had already reviewed both)`}
          .
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Section>
  );
}

export default function AdminDashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [companies, setCompanies] = useState<AdminCompanySummary[]>([]);
  const [prefillName, setPrefillName] = useState<string | null>(null);
  const [prefillNonce, setPrefillNonce] = useState(0);
  // Bumped on every publish — forces PendingSuggestionsSection to remount
  // and re-fetch, so an approved suggestion drops out of the queue the
  // moment it's live rather than needing a manual page refresh. Publishing
  // backfills the matching EmploymentHistory rows' companyId server-side
  // (CompaniesService.createByAdmin), which is what actually makes the
  // suggestion stop existing — this key just makes the UI notice.
  const [suggestionsKey, setSuggestionsKey] = useState(0);

  const loadCompanies = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setCompanies(await apiGet<AdminCompanySummary[]>("/admin/companies"));
    } catch {
      // Non-fatal for the page as a whole — Edit/Merge just show an empty
      // picker until the next successful load (e.g. after Create publishes).
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  function approveSuggestion(rawCompanyName: string) {
    setPrefillName(rawCompanyName);
    setPrefillNonce((n) => n + 1);
    document.getElementById("create-company-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Log in as an admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Admin Portal</h1>
      <p className="mb-6 text-sm text-muted-foreground">Company directory management.</p>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div id="create-company-section">
          {/* key forces a clean remount on every new approved suggestion —
              simpler and safer than reconciling a live prop change against
              whatever the admin may have already started typing. */}
          <CreateCompanySection
            key={prefillNonce}
            prefillName={prefillName}
            onPublished={() => {
              void loadCompanies();
              setSuggestionsKey((k) => k + 1);
            }}
          />
        </div>
        <PendingSuggestionsSection key={suggestionsKey} onApprove={approveSuggestion} />
        <EditCompanySection companies={companies} onSaved={() => void loadCompanies()} />
        <MergeDuplicatesSection companies={companies} onMerged={() => void loadCompanies()} />
      </div>
    </div>
  );
}
