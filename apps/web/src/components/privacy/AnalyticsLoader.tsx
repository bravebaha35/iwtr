"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { analyticsAllowed } from "@/lib/analyticsPolicy";
import { useConsent } from "@/lib/consent";
import { useReviewFlowActive } from "@/lib/reviewFlow";

declare global {
  interface Window {
    // Any analytics integration added later must check this before sending
    // anything: it's set the moment analytics stops being allowed (a private
    // page, or the review form opening), since removing a <script> tag
    // can't unload code that already ran.
    __iwtrAnalyticsDisabled?: boolean;
  }
}

/**
 * Loads the analytics script (NEXT_PUBLIC_ANALYTICS_SRC; none is configured
 * yet, so today this loads nothing) only while lib/analyticsPolicy.ts allows
 * it, and tears it down the moment it doesn't.
 */
export function AnalyticsLoader({ src = process.env.NEXT_PUBLIC_ANALYTICS_SRC }: { src?: string }) {
  const consent = useConsent();
  const pathname = usePathname() ?? "/";
  const reviewFlowActive = useReviewFlowActive();
  const allowed = Boolean(src) && analyticsAllowed({ consent: consent ?? null, pathname, reviewFlowActive });

  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-iwtr-analytics]");
    if (!allowed) {
      if (existing) {
        window.__iwtrAnalyticsDisabled = true;
        existing.remove();
      }
      return;
    }
    window.__iwtrAnalyticsDisabled = false;
    if (existing || !src) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.iwtrAnalytics = "true";
    document.head.appendChild(script);
  }, [allowed, src]);

  return null;
}
