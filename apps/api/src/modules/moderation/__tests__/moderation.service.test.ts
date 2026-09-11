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

    it("a bare job-title / department word alone never flags (2026-09-11 product", () => {
      // decision - JOB_TITLE now requires a name-like span nearby, see
      // checkContent's own comment). Ordinary workplace vocabulary like
      // 'manager'/'HR' on its own must never be a violation, skip list or not.
      expect(svc.checkContent(["our new warehouse manager"]).violates).toBe(false);
      expect(svc.checkContent(["our new warehouse manager"], SKIP).violates).toBe(false);
      expect(svc.checkContent(["OUR MUDUR"]).violates).toBe(false);
      expect(svc.checkContent(["OUR MUDUR"], SKIP).violates).toBe(false);
      expect(svc.checkContent(["I wish HR handled this better"]).violates).toBe(false);
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

describe("ModerationService.checkContent - JOB_TITLE requires a nearby name (2026-09-11)", () => {
  const svc = new ModerationService();

  it("flags a title immediately next to a name-like span", () => {
    const r = svc.checkContent(["CEO Ahmet Yilmaz is terrible to work for"]);
    expect(r.violates).toBe(true);
    expect(r.violationTypes).toContain("JOB_TITLE");
  });

  it("flags a title a few words from a name-like span", () => {
    const r = svc.checkContent(["Our CEO, who everyone calls Ahmet Bey, is terrible"]);
    expect(r.violates).toBe(true);
    expect(r.violationTypes).toContain("JOB_TITLE");
  });

  it("does not flag a title far from an unrelated name-like span in the same long comment", () => {
    const filler = "x".repeat(120);
    const r = svc.checkContent([`I wish HR handled this better. ${filler} My friend Mehmet Kaya agrees.`]);
    expect(r.violationTypes).not.toContain("JOB_TITLE");
    expect(r.violationTypes).toContain("NAME_OR_SURNAME");
  });

  it("still flags a plain name-like span on its own (NAME_OR_SURNAME is unaffected)", () => {
    const r = svc.checkContent(["Ahmet Yilmaz used to work here"]);
    expect(r.violationTypes).toContain("NAME_OR_SURNAME");
    expect(r.violationTypes).not.toContain("JOB_TITLE");
  });

  it("catches a spaced-out (evasive) title next to a name", () => {
    const r = svc.checkContent(["C E O Ahmet Yilmaz is terrible"]);
    expect(r.violationTypes).toContain("JOB_TITLE");
  });

  it("a title+name combo is still skippable via skipViolationTypes (employer's own caption)", () => {
    const r = svc.checkContent(["CEO Ahmet Yilmaz welcomes you"], {
      skipViolationTypes: ["NAME_OR_SURNAME", "JOB_TITLE", "ABUSE_OR_INSULT"],
    });
    expect(r.violates).toBe(false);
  });
});

describe("ModerationService.checkContent - Turkish profanity list", () => {
  const svc = new ModerationService();

  it.each(["aptal", "salak", "orospu", "piç", "ibne", "yavşak"])("flags %s", (word) => {
    expect(svc.checkContent([`bu adam tam bir ${word}`]).violationTypes).toContain("PROFANITY");
  });

  it("catches a spaced-out (evasion) profanity word", () => {
    expect(svc.checkContent(["o r o s p u"]).violationTypes).toContain("PROFANITY");
  });

  it("catches a spaced-out phone number", () => {
    expect(svc.checkContent(["call me on 5 5 5 5 5 5 5 5 5 5"]).violationTypes).toContain("PII_PHONE_NUMBER");
  });
});
