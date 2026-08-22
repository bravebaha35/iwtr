import Link from "next/link";
import { Logo } from "@/components/Logo";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

// Deliberately always the obsidian/zinc palette (bg-zinc-950 etc.), not the
// theme's `bg-background`/`border-border` variables — unlike the rest of the
// app, this footer band doesn't switch with the light/dark toggle. That's
// the explicit design brief, not an oversight.
//
// Real destinations only where a page already exists today (Submit a Review
// -> homepage, where the review flow actually starts from a company card;
// HR Dashboard -> /my/companies, the existing owner dashboard). Every other
// link below is "#" because there's no page to send it to yet — most
// pressingly the three Legal column links: KVKK Aydınlatma Metni and the
// Law 5651 notice-and-takedown page are real regulatory documents, not
// placeholder copy this component should be inventing, so they're left as
// explicit stand-ins for real legal content rather than shipped as either a
// dead link with no page or fabricated legal text.
const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Platform",
    links: [
      { label: "Submit a Review", href: "/" },
      { label: "Job Categories", href: "#" },
      { label: "Anonymity Policy", href: "#" },
    ],
  },
  {
    title: "Employers (B2B)",
    links: [
      { label: "Claim Profile", href: "#" },
      { label: "HR Dashboard", href: "/my/companies" },
      { label: "Pricing", href: "#" },
    ],
  },
  {
    title: "Legal (KVKK & 5651)",
    links: [
      { label: "Terms of Service", href: "#" },
      { label: "KVKK Aydınlatma Metni", href: "#" },
      { label: "Notice & Takedown (Uyar-Kaldır)", href: "#" },
    ],
  },
];

export function GlobalFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-800 bg-zinc-950">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-12 sm:grid-cols-3">
        {FOOTER_COLUMNS.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-50">{column.title}</h3>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-zinc-400 transition hover:text-zinc-50">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 border-t border-zinc-800 px-6 py-6 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="text-sm font-semibold text-zinc-50">I Worked There</span>
        </div>
        <p className="text-sm text-zinc-400">&copy; 2026 iworkedthere.com. All rights reserved.</p>
      </div>
    </footer>
  );
}
