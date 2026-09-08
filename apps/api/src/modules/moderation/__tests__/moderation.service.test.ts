import { ModerationService } from "../moderation.service";
import type { ContentViolationType } from "@iwtr/shared-types";

// COMMIT 2: checkContent gained an optional { skipViolationTypes } opt-out so
// an employer's own IWT Social post caption can name its own staff and job
// roles. Only NAME_OR_SURNAME / JOB_TITLE are softenable; profanity, sexual
// content, phone numbers and the shouting/caps check always apply. Comment
// bodies (SocialService.addComment) still get the full ruleset.
describe("ModerationService.checkContent", () => {
  const svc = new ModerationService();
  const SKIP: { skipViolationTypes: ContentViolationType[] } = {
    skipViolationTypes: ["NAME_OR_SURNAME", "JOB_TITLE"],
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

    it("is byte-identical whether options is omitted, empty, or an empty skip list", () => {
      const a = svc.checkContent(["New Office"]);
      const b = svc.checkContent(["New Office"], {});
      const c = svc.checkContent(["New Office"], { skipViolationTypes: [] });
      expect(b).toEqual(a);
      expect(c).toEqual(a);
    });
  });

  describe("with skipViolationTypes: names + job titles are allowed", () => {
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
  });

  describe("with skipViolationTypes: everything else still hard-rejects", () => {
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

    it("still rejects shouting / all-caps", () => {
      const r = svc.checkContent(["WE ARE THRILLED TO OPEN OUR NEW OFFICE TODAY"], SKIP);
      expect(r.violates).toBe(true);
      expect(r.violationTypes).toContain("ABUSE_OR_INSULT");
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
