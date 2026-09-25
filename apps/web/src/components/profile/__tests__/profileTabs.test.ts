import { profileTabsFor } from "../profileTabs";

describe("profileTabsFor", () => {
  it("gives members a Messages tab", () => {
    expect(profileTabsFor(false).map((t) => t.key)).toContain("messages");
  });

  it("gives company owners no Messages tab — they get messages in the company dashboard", () => {
    const keys = profileTabsFor(true).map((t) => t.key);
    expect(keys).not.toContain("messages");
    expect(keys).toEqual(["customize", "personal", "contact", "education", "cv", "security", "account"]);
  });
});
