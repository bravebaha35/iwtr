import type { Metadata } from "next";
import { JobsBrowser } from "@/components/JobsBrowser";

export const metadata: Metadata = {
  title: "Jobs",
  description: "Open positions at companies rated anonymously by the people who worked there.",
};

// A separate page from the homepage rating browser on purpose — see
// JobsBrowser.tsx's top comment. Publicly reachable the same way
// /companies/[slug] already is; the header's "Jobs" nav link is just gated
// behind login like the rest of the account-controls nav group.
export default function JobsPage() {
  return <JobsBrowser />;
}
