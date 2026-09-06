"use client";

import { TurkishPhoneInput } from "@/components/TurkishPhoneInput";

export interface ContactSocialCategoryProps {
  city: string | null;
  contactEmail: string;
  setContactEmail: (v: string) => void;
  contactPhone: string;
  setContactPhone: (v: string) => void;
  facebookUrl: string;
  setFacebookUrl: (v: string) => void;
  instagramUrl: string;
  setInstagramUrl: (v: string) => void;
  whatsappUrl: string;
  setWhatsappUrl: (v: string) => void;
  xUrl: string;
  setXUrl: (v: string) => void;
  linkedinUrl: string;
  setLinkedinUrl: (v: string) => void;
  youtubeUrl: string;
  setYoutubeUrl: (v: string) => void;
  glassdoorUrl: string;
  setGlassdoorUrl: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  status: string | null;
  error: string | null;
}

function SocialField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {label} <span className="text-muted-foreground/70">(optional)</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
      />
    </label>
  );
}

export function ContactSocialCategory(props: ContactSocialCategoryProps) {
  return (
    <div className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
      <h3 className="mb-4 font-semibold text-foreground">Contact & Social Media</h3>

      <div className="grid max-w-3xl grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <div className="text-xs text-muted-foreground sm:col-span-2">
          <p className="font-semibold text-foreground">Notice on Contact Numbers:</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>
              <span className="font-medium">Sole Proprietorships (Şahıs Şirketleri):</span> If an official corporate
              landline is unavailable, you may register using your personal or primary mobile number.
            </li>
            <li>
              <span className="font-medium">Corporate Entities (A.Ş., LTD. ŞTİ., etc.):</span> You must provide an
              official corporate landline number accompanied by your city&apos;s official Turkish area code.
            </li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground sm:col-span-2">
          Official website URL is set from the General Information tab (a paid-tier field, alongside the
          About/Description text).
        </p>
        <label className="text-xs font-medium text-muted-foreground">
          Public HR / Contact Email <span className="text-red-600 dark:text-red-400">(required)</span>
          <input
            type="email"
            value={props.contactEmail}
            onChange={(e) => props.setContactEmail(e.target.value)}
            placeholder="hr@company.com"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
          />
        </label>

        <label className="text-xs font-medium text-muted-foreground">
          Business Phone Number <span className="text-red-600 dark:text-red-400">(required)</span>
          <div className="mt-1">
            <TurkishPhoneInput value={props.contactPhone} onChange={props.setContactPhone} suggestedProvince={props.city} />
          </div>
        </label>

        <SocialField label="LinkedIn" value={props.linkedinUrl} onChange={props.setLinkedinUrl} placeholder="https://linkedin.com/company/..." />
        <SocialField label="X (Twitter)" value={props.xUrl} onChange={props.setXUrl} placeholder="https://x.com/..." />
        <SocialField label="Instagram" value={props.instagramUrl} onChange={props.setInstagramUrl} placeholder="https://instagram.com/..." />
        <SocialField label="Facebook" value={props.facebookUrl} onChange={props.setFacebookUrl} placeholder="https://facebook.com/..." />
        <SocialField label="YouTube" value={props.youtubeUrl} onChange={props.setYoutubeUrl} placeholder="https://youtube.com/@..." />
        <SocialField label="Glassdoor" value={props.glassdoorUrl} onChange={props.setGlassdoorUrl} placeholder="https://glassdoor.com/..." />
        <SocialField label="WhatsApp" value={props.whatsappUrl} onChange={props.setWhatsappUrl} placeholder="https://wa.me/..." />
      </div>

      <button
        onClick={props.onSave}
        disabled={props.saving || !props.contactEmail.trim() || !props.contactPhone.trim() || props.contactPhone.trim() === "+90"}
        className="mt-4 self-start rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        Save changes
      </button>
      {props.status && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{props.status}</p>}
      {props.error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{props.error}</p>}
    </div>
  );
}
