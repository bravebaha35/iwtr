"use client";

import { TurkishPhoneInput } from "@/components/TurkishPhoneInput";
import { OwnerNameInMessagesToggle } from "./OwnerNameInMessagesToggle";

export interface ContactSocialCategoryProps {
  companyId: string;
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
  youtubeUrl: string;
  setYoutubeUrl: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  status: string | null;
  error: string | null;
}

const FIELD_LABEL = "block text-xs font-medium text-muted-foreground";
const INPUT = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground";
const SUBHEADING = "mb-3 text-sm font-semibold text-foreground";

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
    <label className={FIELD_LABEL}>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={INPUT} />
    </label>
  );
}

/**
 * One box, top to bottom: how applicants reach the company (email and
 * phone), the "show my name in messages" tick-box, then social media links.
 */
export function ContactSocialCategory(props: ContactSocialCategoryProps) {
  const noContact = !props.contactEmail.trim() && (!props.contactPhone.trim() || props.contactPhone.trim() === "+90");

  return (
    <div className="rounded-xl border border-border p-6">
      <h3 className="mb-4 font-semibold text-foreground">Contact & Social Media</h3>

      <section className="max-w-3xl">
        <h4 className={SUBHEADING}>How applicants reach you</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Add at least one: an email or a phone number. Adding both is best.
        </p>
        <div className="grid grid-cols-1 items-start gap-x-6 gap-y-3 sm:grid-cols-2">
          <label className={FIELD_LABEL}>
            Email
            <input
              type="email"
              value={props.contactEmail}
              onChange={(e) => props.setContactEmail(e.target.value)}
              placeholder="hr@company.com"
              className={INPUT}
            />
          </label>

          <div className={FIELD_LABEL}>
            Phone number
            <div className="mt-1">
              <TurkishPhoneInput value={props.contactPhone} onChange={props.setContactPhone} suggestedProvince={props.city} />
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
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
      </section>

      <section className="mt-6 max-w-3xl border-t border-border pt-5">
        <OwnerNameInMessagesToggle companyId={props.companyId} />
      </section>

      <section className="mt-6 max-w-3xl border-t border-border pt-5">
        <h4 className={SUBHEADING}>
          Social media <span className="font-normal text-muted-foreground">(optional)</span>
        </h4>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <SocialField label="Instagram" value={props.instagramUrl} onChange={props.setInstagramUrl} placeholder="https://instagram.com/..." />
          <SocialField label="Facebook" value={props.facebookUrl} onChange={props.setFacebookUrl} placeholder="https://facebook.com/..." />
          <SocialField label="X (Twitter)" value={props.xUrl} onChange={props.setXUrl} placeholder="https://x.com/..." />
          <SocialField label="YouTube" value={props.youtubeUrl} onChange={props.setYoutubeUrl} placeholder="https://youtube.com/@..." />
          <SocialField label="WhatsApp" value={props.whatsappUrl} onChange={props.setWhatsappUrl} placeholder="https://wa.me/..." />
        </div>
      </section>

      <div className="mt-6 flex max-w-3xl flex-wrap items-center gap-3 border-t border-border pt-5">
        <button
          type="button"
          onClick={props.onSave}
          disabled={props.saving || noContact}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Save changes
        </button>
        <span className="text-xs text-muted-foreground">Saves your email, phone number and social media links.</span>
      </div>
      {props.status && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{props.status}</p>}
      {props.error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{props.error}</p>}
    </div>
  );
}
