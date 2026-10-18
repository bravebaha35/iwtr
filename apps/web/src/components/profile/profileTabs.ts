export type ProfileTabKey =
  | "customize"
  | "personal"
  | "contact"
  | "education"
  | "references"
  | "cv"
  | "ratings"
  | "security"
  | "account";

// The /me sidebar tabs. Messages used to be one of them; they now live in
// the chat dock. My Ratings used to be its own top-bar page (/me/reviews,
// which now redirects here) and sits right under My CV.
export const PROFILE_TABS: { key: ProfileTabKey; label: string }[] = [
  { key: "customize", label: "Customize" },
  { key: "personal", label: "Personal Information" },
  { key: "contact", label: "Contact Information" },
  { key: "education", label: "Education & Work History" },
  { key: "references", label: "References" },
  { key: "cv", label: "My CV" },
  { key: "ratings", label: "My Ratings" },
  { key: "security", label: "Security" },
  { key: "account", label: "Account Options" },
];

// Tabs that belong to a member's job-seeker side. A company owner reaches
// their company through the Dashboard instead and has no CV to fill in.
const MEMBER_ONLY_TABS: ProfileTabKey[] = ["references", "ratings"];

export function profileTabsFor(isCompanyOwner: boolean): { key: ProfileTabKey; label: string }[] {
  return isCompanyOwner ? PROFILE_TABS.filter((tab) => !MEMBER_ONLY_TABS.includes(tab.key)) : PROFILE_TABS;
}
