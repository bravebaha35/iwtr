import type { WorkplaceType } from "@iwtr/shared-types";
import { ratingImageSrc } from "../ratingNarrative";

describe("ratingImageSrc", () => {
  it.each<[number, WorkplaceType, string]>([
    [1.0, "OFFICE", "/office1.png"],
    [2.0, "OFFICE", "/office2.png"],
    [3.5, "MANUAL_LABOUR", "/manuallabour3.png"],
    [4.0, "SERVICE", "/service4.png"],
    [4.7, "OFFICE", "/office4.png"],
    [5.0, "HYBRID_REMOTE", "/hybrid4.png"],
    [1.9, "SERVICE", "/service1.png"],
  ])("maps score %p / %s to %s", (score, workplaceType, expected) => {
    expect(ratingImageSrc(score, workplaceType)).toBe(expected);
  });
});
