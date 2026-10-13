import {
  createSocialCommentInputSchema,
  createSocialPostInputSchema,
  reactToSocialPostInputSchema,
  validateSocialImageUpload,
  scheduleSocialPostInputSchema,
  recordSocialViewsInputSchema,
  SOCIAL_VIEW_BATCH_MAX,
  SOCIAL_SCHEDULED_POST_LIMITS,
  SOCIAL_INSIGHTS_DAYS,
  SOCIAL_INSIGHTS_PERIODS,
  SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES,
} from "../social";

describe("social schemas", () => {
  it("rejects an empty comment body", () => {
    expect(createSocialCommentInputSchema.safeParse({ body: "   " }).success).toBe(false);
  });
  it("accepts a normal comment body", () => {
    expect(createSocialCommentInputSchema.safeParse({ body: "great place" }).success).toBe(true);
  });
  it("rejects a non-image mime type", () => {
    expect(validateSocialImageUpload({ mimeType: "application/pdf", sizeBytes: 10 }).valid).toBe(false);
  });
  it("rejects an oversized file", () => {
    expect(
      validateSocialImageUpload({ mimeType: "image/jpeg", sizeBytes: SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES + 1 }).valid,
    ).toBe(false);
  });
  it("accepts a normal HEIC upload", () => {
    expect(validateSocialImageUpload({ mimeType: "image/heic", sizeBytes: 2_000_000 }).valid).toBe(true);
  });
});

const CID = "11111111-1111-1111-1111-111111111111";
const ok = (body: unknown) => createSocialPostInputSchema.safeParse(body).success;

describe("createSocialPostInputSchema (multipart form fields, so every value is text)", () => {
  it("a post with no kind is a plain photo post, as before post kinds existed", () => {
    expect(createSocialPostInputSchema.parse({ companyId: CID, caption: "  hello  " })).toMatchObject({ kind: "PHOTO", caption: "hello" });
  });

  it("a poll reads its answers from a JSON string and its length from a number in text", () => {
    const parsed = createSocialPostInputSchema.parse({
      companyId: CID, kind: "POLL", caption: "Which shift?", pollOptions: JSON.stringify([" Morning ", "Night"]), pollDays: "7",
    });
    expect(parsed.pollOptions).toEqual(["Morning", "Night"]);
    expect(parsed.pollDays).toBe(7);
  });

  it("a poll needs a question, 2 to 4 different answers and one of the offered lengths", () => {
    const poll = (over: Record<string, unknown>) =>
      ok({ companyId: CID, kind: "POLL", caption: "Which shift?", pollOptions: JSON.stringify(["Morning", "Night"]), pollDays: "3", ...over });
    expect(poll({})).toBe(true);
    expect(poll({ caption: undefined })).toBe(false);
    expect(poll({ pollOptions: JSON.stringify(["Only one"]) })).toBe(false);
    expect(poll({ pollOptions: JSON.stringify(["a", "b", "c", "d", "e"]) })).toBe(false);
    expect(poll({ pollOptions: JSON.stringify(["Morning", "morning"]) })).toBe(false);
    expect(poll({ pollOptions: "not json" })).toBe(false);
    expect(poll({ pollOptions: undefined })).toBe(false);
    expect(poll({ pollDays: "5" })).toBe(false);
    expect(poll({ pollDays: undefined })).toBe(false);
  });

  it("an event needs a name and a time, a milestone a headline, a hiring post a job posting", () => {
    const when = new Date().toISOString();
    expect(ok({ companyId: CID, kind: "EVENT", title: "Open day", eventStartsAt: when })).toBe(true);
    expect(ok({ companyId: CID, kind: "EVENT", eventStartsAt: when })).toBe(false);
    expect(ok({ companyId: CID, kind: "EVENT", title: "Open day" })).toBe(false);
    expect(ok({ companyId: CID, kind: "EVENT", title: "Open day", eventStartsAt: "next Friday" })).toBe(false);

    expect(ok({ companyId: CID, kind: "MILESTONE", title: "10 years" })).toBe(true);
    expect(ok({ companyId: CID, kind: "MILESTONE" })).toBe(false);

    expect(ok({ companyId: CID, kind: "HIRING", jobPostingId: CID })).toBe(true);
    expect(ok({ companyId: CID, kind: "HIRING" })).toBe(false);
    expect(ok({ companyId: CID, kind: "HIRING", jobPostingId: "j1" })).toBe(false);
  });
});

describe("reactToSocialPostInputSchema", () => {
  it("takes no body (a plain like) or one of the three reactions", () => {
    expect(reactToSocialPostInputSchema.parse({})).toEqual({});
    expect(reactToSocialPostInputSchema.safeParse({ reaction: "WELL_DONE" }).success).toBe(true);
    expect(reactToSocialPostInputSchema.safeParse({ reaction: "ANGRY" }).success).toBe(false);
  });
});

describe("phase 4: posting later, views, insights", () => {
  const COMPANY = "11111111-1111-4111-8111-111111111111";
  const at = "2026-10-20T07:30:00.000Z";

  it("a scheduled post is the same form as a post, plus the moment it goes out", () => {
    expect(scheduleSocialPostInputSchema.parse({ companyId: COMPANY, caption: "hello", publishAt: at })).toMatchObject({ kind: "PHOTO", publishAt: at });
    // The moment is required and must be a real one.
    expect(scheduleSocialPostInputSchema.safeParse({ companyId: COMPANY, caption: "hello" }).success).toBe(false);
    expect(scheduleSocialPostInputSchema.safeParse({ companyId: COMPANY, caption: "hello", publishAt: "tomorrow" }).success).toBe(false);
    // Each kind still needs its own fields.
    expect(scheduleSocialPostInputSchema.safeParse({ companyId: COMPANY, kind: "POLL", caption: "Q?", publishAt: at }).success).toBe(false);
    expect(
      scheduleSocialPostInputSchema.safeParse({ companyId: COMPANY, kind: "POLL", caption: "Q?", pollOptions: '["A","B"]', pollDays: "3", publishAt: at }).success,
    ).toBe(true);
  });

  it("a views report is a short list of post ids", () => {
    expect(recordSocialViewsInputSchema.safeParse({ postIds: [COMPANY] }).success).toBe(true);
    expect(recordSocialViewsInputSchema.safeParse({ postIds: [] }).success).toBe(false);
    expect(recordSocialViewsInputSchema.safeParse({ postIds: ["not-an-id"] }).success).toBe(false);
    expect(recordSocialViewsInputSchema.safeParse({ postIds: Array(SOCIAL_VIEW_BATCH_MAX + 1).fill(COMPANY) }).success).toBe(false);
  });

  it("each plan gets more than the one below it", () => {
    const order = ["FREE", "STARTER", "PRO", "ENTERPRISE"] as const;
    for (const table of [SOCIAL_SCHEDULED_POST_LIMITS, SOCIAL_INSIGHTS_DAYS]) {
      const values = order.map((tier) => table[tier]);
      expect([...values].sort((a, b) => a - b)).toEqual(values);
      expect(new Set(values).size).toBe(4);
    }
    // Free cannot schedule; every plan's reach is one of the offered periods.
    expect(SOCIAL_SCHEDULED_POST_LIMITS.FREE).toBe(0);
    expect(order.map((tier) => SOCIAL_INSIGHTS_DAYS[tier])).toEqual([...SOCIAL_INSIGHTS_PERIODS]);
  });
});
