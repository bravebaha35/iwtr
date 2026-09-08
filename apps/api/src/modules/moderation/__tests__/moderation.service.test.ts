import { ModerationService } from "../moderation.service";
import type { SkippableViolationType } from "@iwtr/shared-types";

// checkContent has an optional { skipViolationTypes } opt-out so an employer's
// own IWT Social post caption can name its own staff, name a job role, and
// write an all-caps announcement. Only NAME_OR_SURNAME / JOB_TITLE /
// ABUSE_OR_INSULT are skippable; PROFANITY, sexual content (folded into
// PROFANITY) and PII_PHONE_NUMBER always apply. Comment bodies
// (SocialService.addComment) still get the full ruleset.
describe("ModerationService.checkContent", () => {
  const svc = new ModerationService();
  // Exactly what SocialService.createPost passes for a caption.
  const SKIP: { skipViolationTypes: SkippableViolationType[] } = {
    skipViolationTypes: ["NAME_OR_SURNAME", "JOB_TITLE", "ABUSE_OR_INSULT"],
  };

  describe("default behaviour is unchanged (no options)", () => {
    it("flags a name-like caption at the existing 0.5 tier", () => {
      expect(svc.checkContent(["New Office"])).toEqual({
        violates: true,
        violationTypes: ["NAME_OR_SURNAME"],
        confidence: 0.5,
      });
    });

    it("passes a clean caption", () => {
      expect(svc.checkContent(["Thanks to everyone who visited our stand last week"])).toEqual({
        violates: false,
        violationTypes: [],
        confidence: 0.95,
      });
    });

    it("still rejects a long all-caps string with no options", () => {
      const r = svc.checkContent(["WE ARE THRILLED TO WELCOME EVERYONE THIS WEEKEND"]);
      expect(r.violates).toBe(true);
      expect(r.violationTypes).toContain("ABUSE_OR_INSULT");
    });

    it("is byte-identical whether options is omitted, empty, or an empty skip list", () => {
      const a = svc.checkContent(["New Office"]);
      const b = svc.checkContent(["New Office"], {});
      const c = svc.checkContent(["New Office"], { skipViolationTypes: [] });
      expect(b).toEqual(a);
      expect(c).toEqual(a);
    });
  });

  describe("with the caption skip list: names, job titles and all-caps are allowed", () => {
    it("allows a two-word capitalised phrase that looks like a name", () => {
      expect(svc.checkContent(["New Office"]).violates).toBe(true);
      expect(svc.checkContent(["New Office"], SKIP)).toEqual({
        violates: false,
        violationTypes: [],
        confidence: 0.95,
      });
    });

    it("allows a spaced-out capitalised name (the evasion form)", () => {
      expect(svc.checkContent(["A H M E T"]).violationTypes).toContain("NAME_OR_SURNAME");
      expect(svc.checkContent(["A H M E T"], SKIP).violates).toBe(false);
    });

    it("allows a plain job-title / department word", () => {
      expect(svc.checkContent(["our new warehouse manager"]).violationTypes).toContain("JOB_TITLE");
      expect(svc.checkContent(["our new warehouse manager"], SKIP).violates).toBe(false);
    });

    it("allows a job-title word written in caps", () => {
      expect(svc.checkContent(["OUR MUDUR"]).violationTypes).toContain("JOB_TITLE");
      expect(svc.checkContent(["OUR MUDUR"], SKIP).violates).toBe(false);
    });

    it("allows a long all-caps announcement", () => {
      expect(
        svc.checkContent(["COME VISIT OUR BRAND NEW FLAGSHIP STORE THIS WEEKEND"]).violationTypes,
      ).toContain("ABUSE_OR_INSULT");
      expect(svc.checkContent(["COME VISIT OUR BRAND NEW FLAGSHIP STORE THIS WEEKEND"], SKIP).violates).toBe(false);
    });
  });

  describe("each skippable type is gated independently", () => {
    it("a skip list without ABUSE_OR_INSULT still rejects a long all-caps string", () => {
      const r = svc.checkContent(["WE ARE THRILLED TO OPEN OUR NEW OFFICE TODAY"], {
        skipViolationTypes: ["NAME_OR_SURNAME", "JOB_TITLE"],
      });
      expect(r.violates).toBe(true);
      expect(r.violationTypes).toContain("ABUSE_OR_INSULT");
    });
  });

  describe("with the caption skip list: profanity and PII still hard-reject", () => {
    it("still rejects profanity", () => {
      const r = svc.checkContent(["this office is shit"], SKIP);
      expect(r.violates).toBe(true);
      expect(r.violationTypes).toContain("PROFANITY");
    });

    it("still rejects a phone number", () => {
      const r = svc.checkContent(["call us on 0555 123 45 67"], SKIP);
      expect(r.violates).toBe(true);
      expect(r.violationTypes).toContain("PII_PHONE_NUMBER");
    });

    it("filters only the skipped types out of a mixed result", () => {
      const plain = svc.checkContent(["New Office looks like shit"]);
      expect(plain.violationTypes).toEqual(expect.arrayContaining(["PROFANITY", "NAME_OR_SURNAME"]));

      const softened = svc.checkContent(["New Office looks like shit"], SKIP);
      expect(softened.violates).toBe(true);
      expect(softened.violationTypes).toEqual(["PROFANITY"]);
      expect(softened.confidence).toBe(0.95);
    });
  });
});
