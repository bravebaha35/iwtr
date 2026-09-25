import { publicReviewerName } from "../display-name.util";

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
