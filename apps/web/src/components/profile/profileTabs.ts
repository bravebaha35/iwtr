export type ProfileTabKey = "customize" | "personal" | "contact" | "education" | "cv" | "messages" | "security" | "account";

const PROFILE_TABS: { key: ProfileTabKey; label: string }[] = [
  { key: "customize", label: "Customize" },
  { key: "personal", label: "Personal Information" },
  { key: "contact", label: "Contact Information" },
  { key: "education", label: "Education & Work History" },
  { key: "cv", label: "My CV" },
  { key: "messages", label: "Messages" },
  { key: "security", label: "Security" },
  { key: "account", label: "Account Options" },
];

/**
 * The /me sidebar tabs. A company owner (including a reviewer who later
 * claimed their company) has no Messages tab: their messages arrive only
 * through the company dashboard.
 */
export function profileTabsFor(isCompanyOwner: boolean): { key: ProfileTabKey; label: string }[] {
  return isCompanyOwner ? PROFILE_TABS.filter((t) => t.key !== "messages") : PROFILE_TABS;
}
