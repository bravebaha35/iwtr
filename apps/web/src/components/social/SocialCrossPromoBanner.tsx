import Link from "next/link";
import { IwtSocialIcon } from "@/components/icons/IwtSocialIcon";

// Sits below the comments on the rating page (collapsed or expanded). Routes
// to that company's IWT Social profile. Exact title copy, including the
// space before "!".
export function SocialCrossPromoBanner({ companySlug }: { companySlug: string; companyName?: string }) {
  return (
    <Link
      href={`/social/${companySlug}`}
      className="mt-6 block overflow-hidden rounded-xl border border-border bg-surface transition hover:border-brand-400"
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface-muted px-4 py-2">
        <IwtSocialIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">IWT Social</span>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <p className="text-lg font-bold text-foreground">See what they are doing !</p>
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </Link>
  );
}
