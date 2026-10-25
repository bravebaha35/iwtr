import { publicReviewerAvatar, publicReviewerName } from "../display-name.util";
import { avatarKeyForGender } from "../../profile/profile.service";

describe("publicReviewerName", () => {
  it("uses the review's one-off displayUsername when the identity is randomized", () => {
    expect(
      publicReviewerName({ isRandomizedIdentity: true, displayUsername: "Brave Otter" }, { reviewUsername: "Real Handle" }),
    ).toBe("Brave Otter");
  });

  it("uses the author's reviewUsername otherwise", () => {
    expect(
      publicReviewerName({ isRandomizedIdentity: false, displayUsername: null }, { reviewUsername: "Real Handle" }),
    ).toBe("Real Handle");
  });

  it("is null when the author has no handle", () => {
    expect(publicReviewerName({ isRandomizedIdentity: false, displayUsername: null }, null)).toBeNull();
  });
});

describe("publicReviewerAvatar", () => {
  const author = (gender: "MALE" | "FEMALE" | null, avatarKey: string) => ({ avatarKey, avatarGradient: "ocean", gender });

  it("shows the female secret beaver for a randomized review by a woman", () => {
    expect(publicReviewerAvatar({ isRandomizedIdentity: true }, author("FEMALE", "office_f2")).avatarKey).toBe("randomized_identity_f");
  });

  it("shows the male secret beaver for a randomized review by a man", () => {
    expect(publicReviewerAvatar({ isRandomizedIdentity: true }, author("MALE", "office_2")).avatarKey).toBe("randomized_identity");
  });

  it("falls back to the avatar's gender for accounts made before gender was asked", () => {
    expect(publicReviewerAvatar({ isRandomizedIdentity: true }, author(null, "manual_f3")).avatarKey).toBe("randomized_identity_f");
    expect(publicReviewerAvatar({ isRandomizedIdentity: true }, author(null, "manual_3")).avatarKey).toBe("randomized_identity");
  });

  it("never shows the author's own avatar or gradient on a randomized review", () => {
    const shown = publicReviewerAvatar({ isRandomizedIdentity: true }, author("FEMALE", "office_f2"));
    expect(shown.avatarKey).not.toBe("office_f2");
    expect(shown.avatarGradient).not.toBe("ocean");
  });

  it("shows the author's own avatar otherwise", () => {
    expect(publicReviewerAvatar({ isRandomizedIdentity: false }, author("FEMALE", "office_f2"))).toEqual({
      avatarKey: "office_f2",
      avatarGradient: "ocean",
    });
  });
});

describe("avatarKeyForGender", () => {
  it("moves a beaver to the same one of the other gender", () => {
    expect(avatarKeyForGender("office_2", "FEMALE")).toBe("office_f2");
    expect(avatarKeyForGender("remote_f4", "MALE")).toBe("remote_4");
    expect(avatarKeyForGender("manual_1", "MALE")).toBe("manual_1");
  });

  it("leaves no avatar or an unknown key alone", () => {
    expect(avatarKeyForGender(null, "FEMALE")).toBeNull();
    expect(avatarKeyForGender("randomized_identity", "FEMALE")).toBe("randomized_identity");
  });
});
