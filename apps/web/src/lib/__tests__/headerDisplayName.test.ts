import type { OnboardingStatus } from "@iwtr/shared-types";
import { headerDisplayName } from "../headerDisplayName";

const base: OnboardingStatus = {
  status: "ACTIVE",
  country: "TR",
  city: "İzmir",
  district: "Buca",
  avatarKey: "office-1",
  avatarGradient: "g1",
  reviewUsername: "Chief Happiness Officer",
  displayName: null,
  showUsernameInHeader: false,
  ownerName: null,
  ownerPhotoUrl: null,
  companyAccount: null,
};

describe("headerDisplayName", () => {
  it("shows a company owner's real name, not their random username or chosen display name", () => {
    expect(headerDisplayName({ ...base, ownerName: "Ayşe Yılmaz", displayName: "Boss" }, true)).toBe("Ayşe Yılmaz");
  });

  it("never falls back to the random username for an owner with no name on file", () => {
    expect(headerDisplayName(base, true)).toBe("Company owner");
  });

  it("members keep their display name, then their random username", () => {
    expect(headerDisplayName({ ...base, displayName: "Deniz" }, false)).toBe("Deniz");
    expect(headerDisplayName(base, false)).toBe("Chief Happiness Officer");
  });

  it("a member who ticked 'show my username' sees the username, not the display name", () => {
    const ticked = { ...base, displayName: "Deniz", showUsernameInHeader: true };
    expect(headerDisplayName(ticked, false)).toBe("Chief Happiness Officer");
  });

  it("the tick never changes what an owner sees", () => {
    const ticked = { ...base, ownerName: "Ay\u015fe Y\u0131lmaz", showUsernameInHeader: true };
    expect(headerDisplayName(ticked, true)).toBe("Ay\u015fe Y\u0131lmaz");
  });
});
