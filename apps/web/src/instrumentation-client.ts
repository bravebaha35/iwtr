// Runs in the browser before the app starts. Error monitoring is only loaded
// when it is switched on (NEXT_PUBLIC_SENTRY_DSN), as its own small download,
// so pages stay as light as before while it is off. See lib/monitoring.ts.
import { MONITORING_TUNNEL, SENTRY_DSN, sentryBaseOptions } from "@/lib/monitoring";

if (SENTRY_DSN) {
  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init({
        ...sentryBaseOptions,
        tunnel: MONITORING_TUNNEL,
        // Errors only. No session pings, page-speed or tracing data and no
        // record of console output or clicks: nothing is sent on an ordinary
        // page view, and nothing about what the visitor did.
        integrations: (defaults) =>
          defaults.filter(
            (i) => !["BrowserSession", "BrowserTracing", "WebVitals", "SpanStreaming", "Console", "Breadcrumbs"].includes(i.name),
          ),
      });
    })
    .catch(() => {});
}
