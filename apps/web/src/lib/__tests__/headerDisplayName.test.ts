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
  ownerName: null,
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
});
