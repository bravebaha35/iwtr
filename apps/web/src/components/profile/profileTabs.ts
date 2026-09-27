export type ProfileTabKey = "customize" | "personal" | "contact" | "education" | "cv" | "security" | "account";

// The /me sidebar tabs. Messages used to be one of them; they now live on
// their own top-bar page (/messages) for members and owners alike.
export const PROFILE_TABS: { key: ProfileTabKey; label: string }[] = [
  { key: "customize", label: "Customize" },
  { key: "personal", label: "Personal Information" },
  { key: "contact", label: "Contact Information" },
  { key: "education", label: "Education & Work History" },
  { key: "cv", label: "My CV" },
  { key: "security", label: "Security" },
  { key: "account", label: "Account Options" },
];
