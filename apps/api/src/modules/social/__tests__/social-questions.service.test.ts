import { BadRequestException, ForbiddenException, HttpException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createSocialQuestionInputSchema } from "@iwtr/shared-types";
import { SocialQuestionsService } from "../social-questions.service";
import { socialQuestionsEnabled } from "../social-questions.flag";
import { ModerationService } from "../../moderation/moderation.service";

const CID = "11111111-1111-1111-1111-111111111111";
const at = new Date("2026-10-13T09:41:00Z");

const moderationPass = { checkContent: jest.fn().mockReturnValue({ violates: false, violationTypes: [], confidence: 0.95 }) };
const moderationFail = { checkContent: jest.fn().mockReturnValue({ violates: true, violationTypes: ["PROFANITY"], confidence: 0.95 }) };

function questionRow(over: Record<string, unknown> = {}) {
  return {
    id: "q1",
    body: "Is overtime paid on time?",
    createdAt: at,
    companyId: CID,
    workType: null,
    authorUserId: "asker",
    identityMode: "PERSONAL_CHOSEN",
    randomUsername: null,
    visibility: "PUBLIC",
    company: { slug: "acme", name: "Acme", mainPhotoUrl: null, badgeTier: "FREE" },
    _count: { answers: 0 },
    ...over,
  };
}

function answerRow(over: Record<string, unknown> = {}) {
  return {
    id: "a1",
    questionId: "q1",
    body: "Yes, always.",
    createdAt: at,
    authorUserId: "member-2",
    identityMode: "PERSONAL_CHOSEN",
    randomUsername: null,
    workedThere: false,
    _count: { votes: 0 },
    ...over,
  };
}

// A prisma double: every read answers "nothing" unless a test says otherwise.
function makePrisma(over: Record<string, Record<string, unknown>> = {}) {
  const base: Record<string, Record<string, jest.Mock>> = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ role: "MEMBER" }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ reviewUsername: "QuietOtter", avatarKey: "avatar_beaver", avatarGradient: "g1" }),
      findMany: jest.fn().mockResolvedValue([
        { id: "asker", reviewUsername: "QuietOtter", avatarKey: "avatar_beaver", avatarGradient: "g1" },
        { id: "member-2", reviewUsername: "BusyHeron", avatarKey: "avatar_fox", avatarGradient: "g2" },
      ]),
    },
    company: { findUnique: jest.fn().mockResolvedValue({ id: CID, name: "Acme", hiddenAt: null }) },
    companyOwner: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    employerProfile: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    employmentHistory: { count: jest.fn().mockResolvedValue(0) },
    socialQuestion: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve(questionRow({ ...data, authorUserId: data.authorUserId }))),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    socialAnswer: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve(answerRow(data))),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    socialAnswerVote: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    socialQuestionReport: {
      create: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  for (const [model, methods] of Object.entries(over)) base[model] = { ...base[model], ...(methods as Record<string, jest.Mock>) };
  // The answer and the question's new state are written together.
  const $transaction = jest.fn((ops: Promise<unknown>[]) => Promise.all(ops));
  return Object.assign(base, { $transaction }) as typeof base & { $transaction: typeof $transaction };
}

// The three shapes of "who may be sent this question".
const NOT_HIDDEN_COMPANY = { OR: [{ companyId: null }, { company: { hiddenAt: null } }] };
const viewable = (...extra: unknown[]) => ({ AND: [NOT_HIDDEN_COMPANY, { OR: [{ visibility: "PUBLIC" }, ...extra] }] });
const asOwnerOf = (companyId: string) => ({
  user: { findUnique: jest.fn().mockResolvedValue({ role: "COMPANY_OWNER" }) },
  companyOwner: { findMany: jest.fn().mockResolvedValue([{ companyId }]), count: jest.fn().mockResolvedValue(1) },
});

const service = (prisma: unknown, moderation: unknown = moderationPass) =>
  new SocialQuestionsService(prisma as never, moderation as never);

beforeEach(() => jest.clearAllMocks());

describe("createSocialQuestionInputSchema", () => {
  const body = "Is overtime paid on time?";
  it("takes a company or a kind of work, never both and never neither", () => {
    expect(createSocialQuestionInputSchema.safeParse({ companyId: CID, body }).success).toBe(true);
    expect(createSocialQuestionInputSchema.safeParse({ workType: "OFFICE", body }).success).toBe(true);
    expect(createSocialQuestionInputSchema.safeParse({ companyId: CID, workType: "OFFICE", body }).success).toBe(false);
    expect(createSocialQuestionInputSchema.safeParse({ body }).success).toBe(false);
  });

  it("refuses a too-short question and an owner's real-name mode", () => {
    expect(createSocialQuestionInputSchema.safeParse({ companyId: CID, body: "Pay?" }).success).toBe(false);
    expect(createSocialQuestionInputSchema.safeParse({ companyId: CID, body, identityMode: "OWNER_REAL_NAME" }).success).toBe(false);
  });
});

describe("socialQuestionsEnabled", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it("is on outside production and off in production until switched on", () => {
    delete process.env.SOCIAL_QUESTIONS_ENABLED;
    process.env.NODE_ENV = "test";
    expect(socialQuestionsEnabled()).toBe(true);
    process.env.NODE_ENV = "production";
    expect(socialQuestionsEnabled()).toBe(false);
    process.env.SOCIAL_QUESTIONS_ENABLED = "true";
    expect(socialQuestionsEnabled()).toBe(true);
    process.env.NODE_ENV = "test";
    process.env.SOCIAL_QUESTIONS_ENABLED = "false";
    expect(socialQuestionsEnabled()).toBe(false);
  });
});

describe("SocialQuestionsService.ask", () => {
  it("creates the question under the member's own name and never returns an account id", async () => {
    const prisma = makePrisma();
    const question = await service(prisma).ask("asker", { companyId: CID, body: "Is overtime paid on time?" });

    expect(prisma.socialQuestion.create.mock.calls[0][0].data).toEqual({
      companyId: CID,
      workType: null,
      authorUserId: "asker",
      body: "Is overtime paid on time?",
      identityMode: "PERSONAL_CHOSEN",
      randomUsername: null,
      // Nobody has claimed the company: nobody to see it first.
      visibility: "PUBLIC",
    });
    expect(question).toMatchObject({
      id: "q1",
      mine: true,
      displayUsername: "QuietOtter",
      target: { kind: "company", companySlug: "acme", companyName: "Acme" },
      // The asker cannot answer their own question.
      canAnswer: false,
    });
    expect(JSON.stringify(question)).not.toContain("asker");
    // Hour precision: 09:41 is shown as 09:00.
    expect(question.createdAt).toBe("2026-10-13T09:00:00.000Z");
  });

  it("a question to a claimed company waits for that company; one to a kind of work is shown at once", async () => {
    const claimed = makePrisma({ companyOwner: { count: jest.fn().mockResolvedValue(1) } });
    const question = await service(claimed).ask("asker", { companyId: CID, body: "Is overtime paid on time?" });
    expect(claimed.companyOwner.count).toHaveBeenCalledWith({ where: { companyId: CID, claimStatus: "APPROVED" } });
    expect(claimed.socialQuestion.create.mock.calls[0][0].data.visibility).toBe("PENDING");
    expect(question).toMatchObject({ visibility: "PENDING", canSetVisibility: false, companyAnswered: false });

    const byWork = makePrisma({ companyOwner: { count: jest.fn().mockResolvedValue(1) } });
    await service(byWork).ask("asker", { workType: "OFFICE", body: "Is overtime paid on time?" });
    expect(byWork.socialQuestion.create.mock.calls[0][0].data.visibility).toBe("PUBLIC");
  });

  it("gives a one-off random name when asked for, and shows that instead of the usual one", async () => {
    const prisma = makePrisma();
    const question = await service(prisma).ask("asker", { workType: "SERVICE", body: "How are the night shifts?", identityMode: "PERSONAL_RANDOM" });
    const data = prisma.socialQuestion.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ companyId: null, workType: "SERVICE", identityMode: "PERSONAL_RANDOM" });
    expect(typeof data.randomUsername).toBe("string");
    expect(question.displayUsername).toBe(data.randomUsername);
    expect(question.displayUsername).not.toBe("QuietOtter");
  });

  it("stops at the daily limit with 429", async () => {
    const prisma = makePrisma({ socialQuestion: { count: jest.fn().mockResolvedValue(5) } });
    const attempt = service(prisma).ask("asker", { companyId: CID, body: "Is overtime paid on time?" });
    await expect(attempt).rejects.toBeInstanceOf(HttpException);
    await expect(attempt).rejects.toMatchObject({ status: 429 });
    expect(prisma.socialQuestion.create).not.toHaveBeenCalled();
  });

  it("404s for a hidden or unknown company", async () => {
    const hidden = makePrisma({ company: { findUnique: jest.fn().mockResolvedValue({ id: CID, name: "Acme", hiddenAt: new Date() }) } });
    await expect(service(hidden).ask("asker", { companyId: CID, body: "Is overtime paid on time?" })).rejects.toBeInstanceOf(NotFoundException);
    const unknown = makePrisma({ company: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(service(unknown).ask("asker", { companyId: CID, body: "Is overtime paid on time?" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("refuses text that breaks the content rules", async () => {
    const prisma = makePrisma();
    await expect(service(prisma, moderationFail).ask("asker", { companyId: CID, body: "Is overtime paid on time?" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.socialQuestion.create).not.toHaveBeenCalled();
  });

  it("with the real rules: the asked company's own name is not read as a person's name, a real name still is", async () => {
    const prisma = makePrisma({ company: { findUnique: jest.fn().mockResolvedValue({ id: CID, name: "Demo Finans", hiddenAt: null }) } });
    const real = new ModerationService();
    await expect(service(prisma, real).ask("asker", { companyId: CID, body: "Does Demo Finans pay overtime on time?" })).resolves.toBeDefined();
    await expect(
      service(prisma, real).ask("asker", { companyId: CID, body: "Does Ahmet Yilmaz still run the night shift?" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("SocialQuestionsService.list / get", () => {
  it("a visitor is only sent questions shown to everyone, never one to a company an admin has hidden", async () => {
    const prisma = makePrisma();
    await service(prisma).list(undefined, {});
    const where = prisma.socialQuestion.findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual(viewable());
  });

  it("a member is also sent their own waiting or hidden questions; an owner, everything put to their company", async () => {
    const member = makePrisma();
    await service(member).list("asker", {});
    expect(member.socialQuestion.findMany.mock.calls[0][0].where.AND[0]).toEqual(viewable({ authorUserId: "asker" }));

    const owner = makePrisma(asOwnerOf(CID));
    await service(owner).list("owner", {});
    expect(owner.socialQuestion.findMany.mock.calls[0][0].where.AND[0]).toEqual(viewable({ authorUserId: "owner" }, { companyId: { in: [CID] } }));
  });

  it("says where a question stands, and lets only the asked company's owner change it", async () => {
    const rows = [questionRow({ visibility: "HIDDEN", _count: { answers: 1 } })];
    const companyAnswer = answerRow({ id: "a-co", authorUserId: "owner", identityMode: "OWNER_REAL_NAME" });
    const answers = { findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.identityMode === "OWNER_REAL_NAME" ? [companyAnswer] : [])) };

    const asker = makePrisma({ socialQuestion: { findMany: jest.fn().mockResolvedValue(rows) }, socialAnswer: answers });
    expect((await service(asker).list("asker", {})).questions[0]).toMatchObject({
      visibility: "HIDDEN",
      canSetVisibility: false,
      companyAnswered: true,
      mine: true,
    });

    const owner = makePrisma({ ...asOwnerOf(CID), socialQuestion: { findMany: jest.fn().mockResolvedValue(rows) }, socialAnswer: answers });
    expect((await service(owner).list("owner", {})).questions[0]).toMatchObject({ visibility: "HIDDEN", canSetVisibility: true, companyAnswered: true });
  });

  it("'mine' is empty for a logged-out caller and filters on the caller otherwise", async () => {
    const prisma = makePrisma();
    expect(await service(prisma).list(undefined, { filter: "mine" })).toEqual({ questions: [], nextCursor: null });
    expect(prisma.socialQuestion.findMany).not.toHaveBeenCalled();
    await service(prisma).list("asker", { filter: "mine" });
    expect(prisma.socialQuestion.findMany.mock.calls[0][0].where.AND).toContainEqual({ authorUserId: "asker" });
  });

  it("applies the unanswered, company, work-type and search filters", async () => {
    const prisma = makePrisma();
    await service(prisma).list(undefined, { filter: "unanswered", companySlug: "acme", workplaceTypes: ["OFFICE"], q: " pay " });
    const and = prisma.socialQuestion.findMany.mock.calls[0][0].where.AND;
    expect(and).toContainEqual({ answers: { none: {} } });
    expect(and).toContainEqual({ company: { slug: "acme" } });
    expect(and).toContainEqual({ OR: [{ workType: { in: ["OFFICE"] } }, { company: { workplaceTypes: { hasSome: ["OFFICE"] } } }] });
    expect(and).toContainEqual({
      OR: [{ body: { contains: "pay", mode: "insensitive" } }, { company: { name: { contains: "pay", mode: "insensitive" } } }],
    });
  });

  it("hands back a cursor only when another page exists", async () => {
    const eleven = Array.from({ length: 11 }, (_, i) => questionRow({ id: `q${i}` }));
    const prisma = makePrisma({ socialQuestion: { findMany: jest.fn().mockResolvedValue(eleven) } });
    const page = await service(prisma).list(undefined, {});
    expect(page.questions).toHaveLength(10);
    expect(page.nextCursor).toBe("q9");
  });

  it("puts the company's own answer first and keeps a list to two answers", async () => {
    const companyAnswer = answerRow({ id: "a-co", authorUserId: "owner", identityMode: "OWNER_REAL_NAME" });
    const prisma = makePrisma({
      socialQuestion: { findMany: jest.fn().mockResolvedValue([questionRow({ _count: { answers: 3 } })]) },
      socialAnswer: {
        findMany: jest
          .fn()
          // company answers, then the question's most helpful member answers, then "answered by me".
          .mockResolvedValueOnce([companyAnswer])
          .mockResolvedValueOnce([answerRow({ id: "a1", _count: { votes: 4 } }), answerRow({ id: "a2", authorUserId: "member-3" })])
          .mockResolvedValue([]),
      },
    });
    const { questions } = await service(prisma).list(undefined, {});
    expect(questions[0].answerCount).toBe(3);
    expect(questions[0].answers.map((a) => a.id)).toEqual(["a-co", "a1"]);
    expect(questions[0].answers[0].fromCompany).toBe(true);
    expect(questions[0].answers[1]).toMatchObject({ fromCompany: false, helpfulCount: 4, helpfulByMe: null, displayUsername: "BusyHeron" });
    // Logged out: nobody to answer as.
    expect(questions[0].canAnswer).toBe(false);
  });

  it("canAnswer: another member yes, someone who already answered no, the asked company's owner yes (as the company)", async () => {
    const rows = [questionRow()];
    const asMember = makePrisma({ socialQuestion: { findMany: jest.fn().mockResolvedValue(rows) } });
    expect((await service(asMember).list("member-2", {})).questions[0]).toMatchObject({ canAnswer: true, answersAsCompany: false, mine: false });

    const answered = makePrisma({
      socialQuestion: { findMany: jest.fn().mockResolvedValue(rows) },
      socialAnswer: { findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.authorUserId ? [{ questionId: "q1" }] : [])) },
    });
    expect((await service(answered).list("member-2", {})).questions[0].canAnswer).toBe(false);

    const asOwner = makePrisma({
      socialQuestion: { findMany: jest.fn().mockResolvedValue(rows) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: "COMPANY_OWNER" }) },
      companyOwner: { findMany: jest.fn().mockResolvedValue([{ companyId: CID }]) },
    });
    expect((await service(asOwner).list("owner", {})).questions[0]).toMatchObject({ canAnswer: true, answersAsCompany: true });

    const otherOwner = makePrisma({
      socialQuestion: { findMany: jest.fn().mockResolvedValue(rows) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: "COMPANY_OWNER" }) },
      companyOwner: { findMany: jest.fn().mockResolvedValue([{ companyId: "another" }]) },
    });
    expect((await service(otherOwner).list("owner-2", {})).questions[0].canAnswer).toBe(false);
  });

  it("get 404s when the question is gone or its company is hidden", async () => {
    const prisma = makePrisma();
    await expect(service(prisma).get(undefined, "q1")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.socialQuestion.findFirst.mock.calls[0][0].where.AND[1]).toEqual(viewable());
  });
});

describe("SocialQuestionsService - the company hides or shows a question", () => {
  it("only the asked company's approved owner may change it", async () => {
    const found = { findUnique: jest.fn().mockResolvedValue({ companyId: CID }) };
    await expect(service(makePrisma({ socialQuestion: found })).setVisibility("member-2", "q1", "HIDDEN")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service(makePrisma({ ...asOwnerOf("another"), socialQuestion: found })).setVisibility("owner-2", "q1", "HIDDEN")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    // A kind-of-work question has no company to hide it.
    const byWork = makePrisma({ ...asOwnerOf(CID), socialQuestion: { findUnique: jest.fn().mockResolvedValue({ companyId: null }) } });
    await expect(service(byWork).setVisibility("owner", "q1", "HIDDEN")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service(makePrisma(asOwnerOf(CID))).setVisibility("owner", "q1", "HIDDEN")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("showing it to everyone needs the company's answer first; hiding never does", async () => {
    const question = {
      findUnique: jest.fn().mockResolvedValue({ companyId: CID }),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve(questionRow(data))),
    };
    const unanswered = makePrisma({ ...asOwnerOf(CID), socialQuestion: question });
    await expect(service(unanswered).setVisibility("owner", "q1", "PUBLIC")).rejects.toBeInstanceOf(BadRequestException);
    expect(question.update).not.toHaveBeenCalled();
    expect((await service(unanswered).setVisibility("owner", "q1", "HIDDEN")).visibility).toBe("HIDDEN");

    const answered = makePrisma({ ...asOwnerOf(CID), socialQuestion: question, socialAnswer: { count: jest.fn().mockResolvedValue(1) } });
    expect((await service(answered).setVisibility("owner", "q1", "PUBLIC")).visibility).toBe("PUBLIC");
    expect(answered.socialAnswer.count).toHaveBeenCalledWith({ where: { questionId: "q1", identityMode: "OWNER_REAL_NAME" } });
    expect(question.update).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "q1" }, data: { visibility: "PUBLIC" } }));
  });

  it("the dashboard list: the owner's own company only, every state, with a count of each", async () => {
    await expect(service(makePrisma()).listForCompany("member-2", CID, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service(makePrisma(asOwnerOf("another"))).listForCompany("owner-2", CID, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service(makePrisma(asOwnerOf("another"))).countsForCompany("owner-2", CID)).rejects.toBeInstanceOf(ForbiddenException);

    const prisma = makePrisma({
      ...asOwnerOf(CID),
      socialQuestion: {
        findMany: jest.fn().mockResolvedValue([questionRow({ visibility: "PENDING" })]),
        groupBy: jest.fn().mockResolvedValue([
          { visibility: "PENDING", _count: { _all: 2 } },
          { visibility: "PUBLIC", _count: { _all: 5 } },
        ]),
      },
    });
    const page = await service(prisma).listForCompany("owner", CID, { filter: "waiting" });
    expect(prisma.socialQuestion.findMany.mock.calls[0][0].where).toEqual({ companyId: CID, visibility: "PENDING" });
    expect(page.counts).toEqual({ waiting: 2, hidden: 0, shown: 5 });
    expect(page.questions[0]).toMatchObject({ visibility: "PENDING", canSetVisibility: true, canAnswer: true, answersAsCompany: true });
    // The asker is as anonymous to the company as to anyone else.
    expect(JSON.stringify(page)).not.toContain('"asker"');

    await service(prisma).listForCompany("owner", CID, {});
    expect(prisma.socialQuestion.findMany.mock.calls[1][0].where).toEqual({ companyId: CID });
    expect(await service(prisma).countsForCompany("owner", CID)).toEqual({ waiting: 2, hidden: 0, shown: 5 });
  });
});

describe("SocialQuestionsService.answer", () => {
  const found = (over: Record<string, unknown> = {}) => ({
    id: "q1",
    companyId: CID,
    workType: null,
    authorUserId: "asker",
    visibility: "PUBLIC",
    company: { name: "Acme" },
    ...over,
  });

  it("the owner's answer settles who sees the question: as chosen, or hidden when a waiting one is answered without a choice", async () => {
    const named = { employerProfile: { findUnique: jest.fn().mockResolvedValue({ encFirstName: Buffer.from("x"), encLastName: Buffer.from("y") }) } };
    const waiting = () =>
      makePrisma({ ...asOwnerOf(CID), ...named, socialQuestion: { findFirst: jest.fn().mockResolvedValue(found({ visibility: "PENDING" })) } });

    const shown = waiting();
    await service(shown).answer("owner", "q1", { body: "We pay on the 5th.", visibility: "PUBLIC" });
    expect(shown.$transaction).toHaveBeenCalledTimes(1);
    expect(shown.socialQuestion.update).toHaveBeenCalledWith({ where: { id: "q1" }, data: { visibility: "PUBLIC" }, select: { id: true } });

    const noChoice = waiting();
    await service(noChoice).answer("owner", "q1", { body: "We pay on the 5th." });
    expect(noChoice.socialQuestion.update).toHaveBeenCalledWith({ where: { id: "q1" }, data: { visibility: "HIDDEN" }, select: { id: true } });

    // Already shown and no choice sent: it stays as it is.
    const already = makePrisma({ ...asOwnerOf(CID), ...named, socialQuestion: { findFirst: jest.fn().mockResolvedValue(found()) } });
    await service(already).answer("owner", "q1", { body: "We pay on the 5th." });
    expect(already.socialQuestion.update).not.toHaveBeenCalled();
  });

  it("a member cannot change who sees a question by sending a choice, and cannot answer one they are not shown", async () => {
    const prisma = makePrisma({ socialQuestion: { findFirst: jest.fn().mockResolvedValue(found()) } });
    await service(prisma).answer("member-2", "q1", { body: "Yes, always.", visibility: "HIDDEN" });
    expect(prisma.socialQuestion.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    // The read itself is limited to what this member may see.
    expect(prisma.socialQuestion.findFirst.mock.calls[0][0].where).toEqual({ AND: [{ id: "q1" }, viewable({ authorUserId: "member-2" })] });
  });

  it("a member answers anonymously, with the Worked there mark when the company is in their history", async () => {
    const prisma = makePrisma({
      socialQuestion: { findFirst: jest.fn().mockResolvedValue(found()) },
      employmentHistory: { count: jest.fn().mockResolvedValue(1) },
    });
    const answer = await service(prisma).answer("member-2", "q1", { body: "Yes, always." });
    expect(prisma.employmentHistory.count).toHaveBeenCalledWith({ where: { userId: "member-2", companyId: CID } });
    expect(prisma.socialAnswer.create.mock.calls[0][0].data).toMatchObject({
      questionId: "q1",
      authorUserId: "member-2",
      identityMode: "PERSONAL_CHOSEN",
      workedThere: true,
    });
    expect(answer).toMatchObject({ workedThere: true, fromCompany: false, mine: true, displayUsername: "BusyHeron" });
    expect(JSON.stringify(answer)).not.toContain("member-2");
  });

  it("a kind-of-work question never carries the Worked there mark", async () => {
    const prisma = makePrisma({ socialQuestion: { findFirst: jest.fn().mockResolvedValue(found({ companyId: null, workType: "OFFICE", company: null })) } });
    await service(prisma).answer("member-2", "q1", { body: "Depends on the team." });
    expect(prisma.employmentHistory.count).not.toHaveBeenCalled();
    expect(prisma.socialAnswer.create.mock.calls[0][0].data.workedThere).toBe(false);
  });

  it("the asker cannot answer their own question", async () => {
    const prisma = makePrisma({ socialQuestion: { findFirst: jest.fn().mockResolvedValue(found()) } });
    await expect(service(prisma).answer("asker", "q1", { body: "Me again." })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("the asked company's owner answers under their real name, and needs one on file", async () => {
    const owner = {
      socialQuestion: { findFirst: jest.fn().mockResolvedValue(found()) },
      ...asOwnerOf(CID),
    };
    const noName = makePrisma(owner);
    await expect(service(noName).answer("owner", "q1", { body: "We pay on the 5th." })).rejects.toBeInstanceOf(ForbiddenException);

    const named = makePrisma({
      ...owner,
      employerProfile: { findUnique: jest.fn().mockResolvedValue({ encFirstName: Buffer.from("x"), encLastName: Buffer.from("y") }) },
    });
    // The member's requested mode is ignored for an owner.
    const answer = await service(named).answer("owner", "q1", { body: "We pay on the 5th.", identityMode: "PERSONAL_RANDOM" });
    expect(named.socialAnswer.create.mock.calls[0][0].data).toMatchObject({ identityMode: "OWNER_REAL_NAME", randomUsername: null, workedThere: false });
    expect(answer.fromCompany).toBe(true);
  });

  it("refuses another company's owner, an owner on a kind-of-work question, and an admin", async () => {
    const otherOwner = makePrisma({
      socialQuestion: { findFirst: jest.fn().mockResolvedValue(found()) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: "COMPANY_OWNER" }) },
      companyOwner: { findMany: jest.fn().mockResolvedValue([{ companyId: "another" }]) },
    });
    await expect(service(otherOwner).answer("owner-2", "q1", { body: "Hello." })).rejects.toBeInstanceOf(ForbiddenException);

    const workType = makePrisma({
      socialQuestion: { findFirst: jest.fn().mockResolvedValue(found({ companyId: null, workType: "OFFICE", company: null })) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: "COMPANY_OWNER" }) },
      companyOwner: { findMany: jest.fn().mockResolvedValue([{ companyId: CID }]) },
    });
    await expect(service(workType).answer("owner", "q1", { body: "Hello." })).rejects.toBeInstanceOf(ForbiddenException);

    const admin = makePrisma({
      socialQuestion: { findFirst: jest.fn().mockResolvedValue(found()) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: "ADMIN" }) },
    });
    await expect(service(admin).answer("admin", "q1", { body: "Hello." })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("one answer per account: a second one is a 400, bad text is a 400, an unknown question a 404", async () => {
    const duplicate = makePrisma({
      socialQuestion: { findFirst: jest.fn().mockResolvedValue(found()) },
      socialAnswer: {
        create: jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" })),
      },
    });
    await expect(service(duplicate).answer("member-2", "q1", { body: "Again." })).rejects.toBeInstanceOf(BadRequestException);

    const bad = makePrisma({ socialQuestion: { findFirst: jest.fn().mockResolvedValue(found()) } });
    await expect(service(bad, moderationFail).answer("member-2", "q1", { body: "Rude." })).rejects.toBeInstanceOf(BadRequestException);
    expect(bad.socialAnswer.create).not.toHaveBeenCalled();

    await expect(service(makePrisma()).answer("member-2", "q1", { body: "Hi." })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("SocialQuestionsService - delete, helpful, report", () => {
  it("only the author deletes a question or an answer", async () => {
    const prisma = makePrisma({
      socialQuestion: { findUnique: jest.fn().mockResolvedValue({ authorUserId: "asker" }) },
      socialAnswer: { findUnique: jest.fn().mockResolvedValue({ authorUserId: "member-2" }) },
    });
    await expect(service(prisma).deleteQuestion("owner", "q1")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service(prisma).deleteAnswer("asker", "a1")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service(prisma).deleteQuestion("asker", "q1")).resolves.toEqual({ success: true });
    await expect(service(prisma).deleteAnswer("member-2", "a1")).resolves.toEqual({ success: true });
    expect(prisma.socialQuestion.deleteMany).toHaveBeenCalledWith({ where: { id: "q1" } });
  });

  it("helpful: on, then off, never on your own answer", async () => {
    const prisma = makePrisma({
      socialAnswer: { findFirst: jest.fn().mockResolvedValue({ authorUserId: "member-2" }) },
      socialAnswerVote: { count: jest.fn().mockResolvedValue(1) },
    });
    await expect(service(prisma).toggleHelpful("member-2", "a1")).rejects.toBeInstanceOf(ForbiddenException);
    // Only on an answer to a question this member is shown.
    expect(prisma.socialAnswer.findFirst.mock.calls[0][0].where).toEqual({ id: "a1", question: viewable({ authorUserId: "member-2" }) });
    expect(await service(prisma).toggleHelpful("asker", "a1")).toEqual({ answerId: "a1", helpfulCount: 1, helpfulByMe: true });

    prisma.socialAnswerVote.findUnique.mockResolvedValue({ id: "v1" });
    prisma.socialAnswerVote.count.mockResolvedValue(0);
    expect(await service(prisma).toggleHelpful("asker", "a1")).toEqual({ answerId: "a1", helpfulCount: 0, helpfulByMe: false });
    expect(prisma.socialAnswerVote.delete).toHaveBeenCalledWith({ where: { id: "v1" } });
  });

  it("report: not your own text; the third report re-checks the text and only then queues it", async () => {
    const mine = makePrisma({ socialQuestion: { findFirst: jest.fn().mockResolvedValue({ authorUserId: "asker", body: "x", flaggedForReview: false }) } });
    await expect(service(mine).report("asker", "QUESTION", "q1", "CURSE_WORDS")).rejects.toBeInstanceOf(ForbiddenException);

    const item = { authorUserId: "asker", body: "rude text", flaggedForReview: false };
    const two = makePrisma({
      socialQuestion: { findFirst: jest.fn().mockResolvedValue(item) },
      socialQuestionReport: { count: jest.fn().mockResolvedValue(2) },
    });
    expect(await service(two, moderationFail).report("member-2", "QUESTION", "q1", "CURSE_WORDS")).toEqual({ commentId: "q1", reportCount: 2 });
    expect(two.socialQuestion.update).not.toHaveBeenCalled();

    const three = makePrisma({
      socialAnswer: { findFirst: jest.fn().mockResolvedValue(item) },
      socialQuestionReport: { count: jest.fn().mockResolvedValue(3) },
    });
    await service(three, moderationFail).report("member-2", "ANSWER", "a1", "THREAT_ABUSE");
    expect(three.socialQuestionReport.create).toHaveBeenCalledWith({ data: { answerId: "a1", reporterId: "member-2", reason: "THREAT_ABUSE" } });
    expect(three.socialAnswer.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { flaggedForReview: true, flaggedReviewReason: "PROFANITY" },
    });

    // Three reports on clean text: nothing is queued.
    const clean = makePrisma({
      socialAnswer: { findFirst: jest.fn().mockResolvedValue(item) },
      socialQuestionReport: { count: jest.fn().mockResolvedValue(3) },
    });
    await service(clean).report("member-2", "ANSWER", "a1", "THREAT_ABUSE");
    expect(clean.socialAnswer.update).not.toHaveBeenCalled();
  });

  it("the asked company reports a question still waiting for it; someone who is not shown it cannot", async () => {
    const waiting = { authorUserId: "asker", body: "rude text", flaggedForReview: false };
    const owner = makePrisma({ ...asOwnerOf(CID), socialQuestion: { findFirst: jest.fn().mockResolvedValue(waiting) } });
    expect(await service(owner).report("owner", "QUESTION", "q1", "THREAT_ABUSE")).toEqual({ commentId: "q1", reportCount: 1 });
    expect(owner.socialQuestion.findFirst.mock.calls[0][0].where).toEqual({
      AND: [{ id: "q1" }, viewable({ authorUserId: "owner" }, { companyId: { in: [CID] } })],
    });
    expect(owner.socialQuestionReport.create).toHaveBeenCalledWith({ data: { questionId: "q1", reporterId: "owner", reason: "THREAT_ABUSE" } });

    // The read finds nothing for a member the question is not shown to.
    await expect(service(makePrisma()).report("member-2", "QUESTION", "q1", "THREAT_ABUSE")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("SocialQuestionsService - admin", () => {
  it("lists reported questions and answers with their reasons, flagged first, without an author", async () => {
    const prisma = makePrisma({
      socialQuestion: {
        findMany: jest.fn().mockResolvedValue([
          { id: "q1", body: "Question?", createdAt: at, companyId: CID, flaggedForReview: false, flaggedReviewReason: null, _count: { reports: 1 } },
        ]),
      },
      socialAnswer: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "a1",
            questionId: "q1",
            body: "Answer.",
            createdAt: at,
            flaggedForReview: true,
            flaggedReviewReason: "PROFANITY",
            question: { body: "Question?", companyId: CID },
            _count: { reports: 3 },
          },
        ]),
      },
      socialQuestionReport: {
        findMany: jest.fn().mockResolvedValue([
          { questionId: "q1", answerId: null, reason: "CURSE_WORDS", reporterId: "owner" },
          { questionId: null, answerId: "a1", reason: "THREAT_ABUSE", reporterId: "member-2" },
          { questionId: null, answerId: "a1", reason: "THREAT_ABUSE", reporterId: "member-3" },
          { questionId: null, answerId: "a1", reason: "CURSE_WORDS", reporterId: null },
        ]),
      },
      companyOwner: { findMany: jest.fn().mockResolvedValue([{ companyId: CID, userId: "owner" }]) },
    });
    const items = await service(prisma).adminListReported();
    expect(items.map((i) => [i.kind, i.id])).toEqual([
      ["ANSWER", "a1"],
      ["QUESTION", "q1"],
    ]);
    expect(items[0]).toMatchObject({ questionBody: "Question?", reportCount: 3, reportReasonCounts: { THREAT_ABUSE: 2, CURSE_WORDS: 1 } });
    expect(JSON.stringify(items)).not.toContain("authorUserId");
    // The admin is told the asked company sent a report - as a yes / no, never who.
    expect(items.map((i) => i.reportedByCompany)).toEqual([false, true]);
    expect(JSON.stringify(items)).not.toContain("reporterId");
    expect(JSON.stringify(items)).not.toContain('"owner"');
  });

  it("remove is audit-logged and 404s on an unknown id; dismiss clears the reports", async () => {
    const prisma = makePrisma();
    await service(prisma).adminRemove("admin", "ANSWER", "a1");
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: { actorUserId: "admin", action: "SOCIAL_ANSWER_REMOVED", targetType: "SocialAnswer", targetId: "a1" },
    });
    const gone = makePrisma({ socialQuestion: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) } });
    await expect(service(gone).adminRemove("admin", "QUESTION", "q1")).rejects.toBeInstanceOf(NotFoundException);

    await service(prisma).adminDismiss("QUESTION", "q1");
    expect(prisma.socialQuestionReport.deleteMany).toHaveBeenCalledWith({ where: { questionId: "q1" } });
  });
});
