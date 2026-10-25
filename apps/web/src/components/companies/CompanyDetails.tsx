import type { ReactNode } from "react";
import type { Company } from "@iwtr/shared-types";
import type { TFn } from "@/lib/i18n/core";

// The company page's "Company Details" column, beside Workplace Vibe Flags:
// what the company wrote about itself, where it is, its sector and how to
// reach it. Label / value rows on hairlines (no boxes), contacts as small
// tonal chips. Every field comes down with the page's CompanyDetail, so
// there is no fetch here. Translated like the Vibe Flags beside it (the
// company's own text, name and sector key aside, which come as they are).

type ContactKind = "email" | "phone" | "facebook" | "instagram" | "whatsapp" | "x";

interface Contact {
  kind: ContactKind;
  label: string;
  href: string;
  external: boolean;
}

function contactsOf(company: Company): Contact[] {
  const list: (Contact | null)[] = [
    company.contactEmail ? { kind: "email", label: company.contactEmail, href: `mailto:${company.contactEmail}`, external: false } : null,
    company.contactEmail2 ? { kind: "email", label: company.contactEmail2, href: `mailto:${company.contactEmail2}`, external: false } : null,
    company.contactEmail3 ? { kind: "email", label: company.contactEmail3, href: `mailto:${company.contactEmail3}`, external: false } : null,
    company.contactPhone ? { kind: "phone", label: company.contactPhone, href: `tel:${company.contactPhone}`, external: false } : null,
    company.facebookUrl ? { kind: "facebook", label: "Facebook", href: company.facebookUrl, external: true } : null,
    company.instagramUrl ? { kind: "instagram", label: "Instagram", href: company.instagramUrl, external: true } : null,
    company.whatsappUrl ? { kind: "whatsapp", label: "WhatsApp", href: company.whatsappUrl, external: true } : null,
    company.xUrl ? { kind: "x", label: "X", href: company.xUrl, external: true } : null,
  ];
  return list.filter((c): c is Contact => c !== null);
}

// "https://www.example.com.tr/" -> "example.com.tr"
function displayHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const ICON = "h-4 w-4 shrink-0";

function Glyph({ children, className = ICON }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const ROW_ICONS: Record<"about" | "location" | "sector" | "contact", ReactNode> = {
  about: (
    <Glyph>
      <path d="M4 5h16M4 10h16M4 15h10M4 20h7" />
    </Glyph>
  ),
  location: (
    <Glyph>
      <path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </Glyph>
  ),
  sector: (
    <Glyph>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
    </Glyph>
  ),
  contact: (
    <Glyph>
      <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12Z" />
    </Glyph>
  ),
};

const CONTACT_ICONS: Record<ContactKind, ReactNode> = {
  email: (
    <Glyph className="h-3.5 w-3.5 shrink-0">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </Glyph>
  ),
  phone: (
    <Glyph className="h-3.5 w-3.5 shrink-0">
      <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </Glyph>
  ),
  facebook: (
    <Glyph className="h-3.5 w-3.5 shrink-0">
      <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15Z" />
    </Glyph>
  ),
  instagram: (
    <Glyph className="h-3.5 w-3.5 shrink-0">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17 7h.01" />
    </Glyph>
  ),
  whatsapp: (
    <Glyph className="h-3.5 w-3.5 shrink-0">
      <path d="M20.5 12a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.1-4.2A8.5 8.5 0 1 1 20.5 12Z" />
      <path d="M9 9.5c.3 2.3 2.2 4.2 4.5 4.5l1-1.2 1.8.8c-.2 1-1 1.7-2 1.7A6 6 0 0 1 8.2 9.2c0-1 .7-1.8 1.7-2l.8 1.8Z" />
    </Glyph>
  ),
  x: (
    <Glyph className="h-3.5 w-3.5 shrink-0">
      <path d="M4 4h4.5L20 20h-4.5Z" />
      <path d="M4 20l6.6-7M20 4l-6.4 7" />
    </Glyph>
  ),
};

function ArrowUpRight() {
  return (
    <Glyph className="h-3.5 w-3.5 shrink-0">
      <path d="M7 17 17 7M8 7h9v9" />
    </Glyph>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 py-4 first:pt-0 last:pb-0 sm:grid-cols-[8.5rem_1fr] sm:gap-5">
      <dt className="flex items-center gap-2 self-start text-[13px] font-medium text-muted-foreground sm:pt-px">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 text-[15px] leading-relaxed text-foreground">{children}</dd>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <span className="text-sm text-muted-foreground">{children}</span>;
}

export function CompanyDetails({ company, t }: { company: Company; t: TFn }) {
  const location = [company.district, company.city].filter(Boolean).join(", ");
  const contacts = contactsOf(company);

  return (
    <section aria-labelledby="company-details-heading" className="font-sans">
      <h2 id="company-details-heading" className="text-xl text-foreground">
        {t("Company Details")}
      </h2>

      <dl className="mt-5 divide-y divide-border/70">
        <Row icon={ROW_ICONS.about} label={t("About")}>
          {company.description ? (
            <p className="whitespace-pre-wrap">{company.description}</p>
          ) : (
            <Empty>{t("No information provided yet.")}</Empty>
          )}
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              {displayHost(company.website)}
              <ArrowUpRight />
            </a>
          )}
        </Row>

        <Row icon={ROW_ICONS.location} label={t("Location")}>
          {location ? location : <Empty>{t("Not provided yet.")}</Empty>}
        </Row>

        <Row icon={ROW_ICONS.sector} label={t("Sector")}>
          {t(company.category)}
        </Row>

        <Row icon={ROW_ICONS.contact} label={t("Contact")}>
          {contacts.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {contacts.map((c) => (
                <li key={c.href} className="min-w-0 max-w-full">
                  <a
                    href={c.href}
                    target={c.external ? "_blank" : undefined}
                    rel={c.external ? "noopener noreferrer" : undefined}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-[13px] font-medium text-foreground transition hover:text-brand-700 dark:hover:text-brand-300"
                  >
                    <span className="text-muted-foreground">{CONTACT_ICONS[c.kind]}</span>
                    <span className="truncate">{c.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{t("Not provided yet.")}</Empty>
          )}
        </Row>
      </dl>
    </section>
  );
}
