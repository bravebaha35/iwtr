// Dev-only demo content for IWT Social, so the page can be judged with
// something in it: polls with votes, and Questions in every state - shown to
// everyone with the company's answer and members' answers, waiting for the
// company, kept hidden by the company, put to a company nobody has claimed,
// and put to a kind of work.
//
// Everything is written the way the app itself would have written it: a poll
// by a company's approved owner, a question and an anonymous answer by an
// active member (the Worked there mark only where that company really is in
// the member's employment history), the company's answer by its owner. The
// two dev fast-login accounts are woven in so both sides can be tried: the
// test member has questions of their own in each state, and the dev owner's
// company has questions waiting.
//
// Safe to re-run: a poll or question whose text is already there is skipped.
//
// Run from apps/api: pnpm exec ts-node --transpile-only scripts/seed-social-demo.ts

import "dotenv/config";
import { PrismaClient, type WorkplaceType } from "@prisma/client";
import { pickRandomDisplayUsername } from "../src/modules/reviews/randomized-identity.util";

const prisma = new PrismaClient();

const TEST_MEMBER_EMAIL = "mehmet.ahmetoglu.test@iworkedthere.dev";
const DEV_OWNER_COMPANY = "Demo Finans Holding";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * HOUR);
}
function shuffled<T>(list: T[]): T[] {
  return [...list].sort(() => Math.random() - 0.5);
}

// [question, options, share of the voters per option, days until it closes (negative = closed)]
const POLLS: [string, string[], number[], number][] = [
  ["Which would you rather have next year?", ["A fourth remote day", "A higher meal card", "Two more days of leave"], [5, 3, 6], 5],
  ["When should the weekly team meeting be?", ["Monday morning", "Wednesday after lunch", "Friday morning"], [2, 7, 3], 3],
  ["What should we add to the break room first?", ["A better coffee machine", "A quiet corner", "Table football"], [8, 4, 2], 6],
  ["How do you get to work most days?", ["Company shuttle", "Public transport", "My own car", "On foot or by bike"], [6, 5, 3, 1], 2],
  ["Which training would help you most this quarter?", ["Excel and reporting", "First aid", "English", "Leading a team"], [4, 2, 5, 3], 4],
  ["Summer hours: start early and finish early?", ["Yes, 07:30 to 16:30", "No, keep 09:00 to 18:00"], [9, 4], -1],
];

type AnswerSeed = { body: string; helpful?: number; random?: boolean };
type QuestionSeed = {
  body: string;
  hoursAgo: number;
  // The company's own answer, when it has given one.
  company?: string;
  members?: AnswerSeed[];
  random?: boolean;
};

// Put to a company with an owner. `state` is what the owner did with it.
const CLAIMED: (QuestionSeed & { state: "PUBLIC" | "HIDDEN" | "PENDING" })[] = [
  {
    state: "PUBLIC",
    hoursAgo: 30,
    body: "Is overtime paid, or given back as time off?",
    company: "Overtime is paid at the legal rate with the same month's salary. If you would rather take the time off, tell your team lead before the month closes.",
    members: [
      { body: "Paid, and on time in my two years there. The time off option exists but you have to ask early.", helpful: 6 },
      { body: "Paid. During the busy season it adds up to a real difference.", helpful: 2, random: true },
    ],
  },
  {
    state: "PUBLIC",
    hoursAgo: 52,
    body: "How long does the hiring process take from first interview to offer?",
    company: "Usually two to three weeks: a first call, one interview with the team, then the offer. We tell you the outcome either way.",
    members: [{ body: "Three weeks for me. They did call back when they said they would.", helpful: 4 }],
  },
  {
    state: "PUBLIC",
    hoursAgo: 75,
    body: "Is there a shuttle, and which districts does it cover?",
    company: "Yes. The routes are reviewed twice a year from where people actually live; ask for the current list at your interview.",
    members: [],
  },
  {
    state: "PUBLIC",
    hoursAgo: 120,
    body: "Do new starters get proper training, or do you learn as you go?",
    company: "Every new starter has a two-week plan and one colleague to ask. After that it depends on the role.",
    members: [
      { body: "The first two weeks were well planned. After that it depended a lot on the team you landed in.", helpful: 5 },
      { body: "My colleague for the first month was great. Ask for one if you are not given one.", helpful: 3 },
      { body: "Mostly learning as you go in my department, to be fair.", helpful: 1, random: true },
    ],
  },
  {
    state: "HIDDEN",
    hoursAgo: 20,
    body: "Is it true the night shift bonus is being removed next year?",
    company: "No decision like that has been taken. If anything changes it will be announced to everyone first, in writing.",
  },
  {
    state: "HIDDEN",
    hoursAgo: 96,
    body: "Why did the annual raise come two months late this year?",
    company: "The budget was approved late this year and the raise was paid back to January. We understand the frustration.",
  },
  { state: "PENDING", hoursAgo: 3, body: "Can you move between departments after the first year?" },
  { state: "PENDING", hoursAgo: 9, body: "Is the meal card loaded monthly or daily, and does unused money carry over?", random: true },
  { state: "PENDING", hoursAgo: 27, body: "How many people usually work a weekend shift, and how often does it come round?" },
];

// Put to a company nobody has claimed: shown to everyone at once.
const UNCLAIMED: QuestionSeed[] = [
  {
    hoursAgo: 14,
    body: "What is the break schedule like on a full shift?",
    members: [
      { body: "One hour for lunch and two fifteen-minute breaks. They were kept to, most days.", helpful: 5 },
      { body: "On paper the same. On a busy day the second short break often disappeared.", helpful: 3, random: true },
    ],
  },
  { hoursAgo: 41, body: "Do they pay on the same day every month?", members: [{ body: "Yes, the 5th, never late while I was there.", helpful: 4 }] },
  { hoursAgo: 66, body: "Is the work uniform provided or do you buy it yourself?", members: [] },
];

// Put to everyone in a kind of work.
const BY_WORK: (QuestionSeed & { workType: WorkplaceType })[] = [
  {
    workType: "SERVICE",
    hoursAgo: 6,
    body: "What do you wish you had asked before taking a job with split shifts?",
    members: [
      { body: "Who pays for the trip home and back in the gap. Nobody, it turned out.", helpful: 9 },
      { body: "Whether the gap can be spent on site. A staff room makes a split shift bearable.", helpful: 4 },
    ],
  },
  {
    workType: "OFFICE",
    hoursAgo: 33,
    body: "How do you bring up a raise when the yearly review keeps getting postponed?",
    members: [
      { body: "Ask for the review date in writing. A date on paper tends to be kept.", helpful: 7 },
      { body: "I brought numbers: what I took on since the last raise. It made the talk short.", helpful: 5, random: true },
      { body: "Worth asking what the budget cycle is, so you raise it before it closes.", helpful: 2 },
    ],
  },
  {
    workType: "HYBRID_REMOTE",
    hoursAgo: 58,
    body: "Does your company pay anything towards internet and electricity for home days?",
    members: [{ body: "A fixed monthly amount on the payslip. Small, but it is there.", helpful: 3 }],
  },
  {
    workType: "MANUAL_LABOUR",
    hoursAgo: 80,
    body: "Which safety equipment does the employer have to give you for free?",
    members: [
      { body: "Everything the job needs: helmet, shoes, gloves, glasses, ear protection. You should never be asked to pay.", helpful: 11 },
      { body: "And replacements when they wear out. Ask where to hand in the old pair.", helpful: 4 },
    ],
  },
  { workType: "SERVICE", hoursAgo: 11, body: "Are tips shared equally where you work, or kept by whoever served the table?", members: [] },
];

async function main() {
  const members = await prisma.user.findMany({
    where: { status: "ACTIVE", role: "MEMBER", reviewUsername: { not: null } },
    select: { id: true, email: true },
    take: 200,
  });
  if (members.length < 6) throw new Error("Not enough active members to write demo answers - seed members first.");
  const testMember = members.find((m) => m.email === TEST_MEMBER_EMAIL) ?? null;
  const others = members.filter((m) => m.id !== testMember?.id);

  const owners = await prisma.companyOwner.findMany({
    where: { claimStatus: "APPROVED", company: { hiddenAt: null } },
    select: { userId: true, companyId: true, company: { select: { name: true, workplaceTypes: true } } },
  });
  // Only owners with a name on file: an answer is shown under it.
  const named = new Set(
    (await prisma.employerProfile.findMany({ where: { encFirstName: { not: null }, encLastName: { not: null } }, select: { userId: true } })).map(
      (p) => p.userId,
    ),
  );
  const claimed = owners.filter((o) => named.has(o.userId));
  if (claimed.length === 0) throw new Error("No claimed company with a named owner - run seed-demo-owners.ts first.");
  const devOwner = claimed.find((o) => o.company.name === DEV_OWNER_COMPANY) ?? null;
  // The dev owner's company first, so it gets the first questions of each kind.
  const claimedOrder = [...(devOwner ? [devOwner] : []), ...shuffled(claimed.filter((o) => o !== devOwner))];

  const claimedIds = new Set(owners.map((o) => o.companyId));
  const unclaimed = shuffled(
    await prisma.company.findMany({
      where: { hiddenAt: null, id: { notIn: [...claimedIds] }, employmentHistories: { some: {} } },
      select: { id: true, name: true, workplaceTypes: true },
      take: 30,
    }),
  );

  // --- polls
  let pollsAdded = 0;
  for (const [i, [caption, options, shares, closesInDays]] of POLLS.entries()) {
    const owner = claimedOrder[i % claimedOrder.length];
    if (await prisma.socialPost.findFirst({ where: { kind: "POLL", caption }, select: { id: true } })) continue;
    const createdAt = hoursAgo(closesInDays < 0 ? 9 * 24 : 6 + i * 19);
    const post = await prisma.socialPost.create({
      data: {
        companyId: owner.companyId,
        authorUserId: owner.userId,
        kind: "POLL",
        caption,
        createdAt,
        pollEndsAt: new Date(Date.now() + closesInDays * DAY),
        pollOptions: { create: options.map((text, position) => ({ text, position })) },
      },
      select: { id: true, pollOptions: { select: { id: true, position: true } } },
    });
    const voters = shuffled(others);
    let next = 0;
    for (const option of post.pollOptions) {
      for (let n = 0; n < shares[option.position] && next < voters.length; n++, next++) {
        await prisma.socialPollVote.create({
          data: { postId: post.id, optionId: option.id, userId: voters[next].id, createdAt: new Date(createdAt.getTime() + (next + 1) * 20 * 60_000) },
        });
      }
    }
    pollsAdded++;
  }

  // --- questions
  let questionsAdded = 0;
  let answersAdded = 0;
  // The test member asks every third question, so "My questions" has some.
  let turn = 0;
  function nextAsker(exclude: Set<string>): string {
    turn++;
    if (testMember && turn % 3 === 1 && !exclude.has(testMember.id)) return testMember.id;
    return shuffled(others).find((m) => !exclude.has(m.id))!.id;
  }

  async function addQuestion(
    seed: QuestionSeed,
    target: { companyId: string; workType?: undefined; ownerUserId: string | null } | { companyId?: undefined; workType: WorkplaceType; ownerUserId: null },
    visibility: "PUBLIC" | "HIDDEN" | "PENDING",
    nameWorkType: WorkplaceType,
  ) {
    if (await prisma.socialQuestion.findFirst({ where: { body: seed.body }, select: { id: true } })) return;
    const createdAt = hoursAgo(seed.hoursAgo);
    const askerId = nextAsker(new Set());
    const question = await prisma.socialQuestion.create({
      data: {
        companyId: target.companyId ?? null,
        workType: target.companyId ? null : target.workType,
        authorUserId: askerId,
        body: seed.body,
        identityMode: seed.random ? "PERSONAL_RANDOM" : "PERSONAL_CHOSEN",
        randomUsername: seed.random ? pickRandomDisplayUsername(nameWorkType) : null,
        visibility,
        createdAt,
      },
      select: { id: true },
    });
    questionsAdded++;

    let minutes = 50;
    if (seed.company && target.ownerUserId) {
      await prisma.socialAnswer.create({
        data: {
          questionId: question.id,
          authorUserId: target.ownerUserId,
          body: seed.company,
          identityMode: "OWNER_REAL_NAME",
          createdAt: new Date(createdAt.getTime() + minutes * 60_000),
        },
      });
      answersAdded++;
    }

    // Members who had this company in their history answer first: they are
    // the ones who get the Worked there mark.
    const workedThere = target.companyId
      ? new Set((await prisma.employmentHistory.findMany({ where: { companyId: target.companyId }, select: { userId: true } })).map((e) => e.userId))
      : new Set<string>();
    const pool = [...shuffled(others.filter((m) => workedThere.has(m.id))), ...shuffled(others.filter((m) => !workedThere.has(m.id)))].filter(
      (m) => m.id !== askerId,
    );
    for (const [i, a] of (seed.members ?? []).entries()) {
      const author = pool[i];
      if (!author) break;
      minutes += 95;
      const answer = await prisma.socialAnswer.create({
        data: {
          questionId: question.id,
          authorUserId: author.id,
          body: a.body,
          identityMode: a.random ? "PERSONAL_RANDOM" : "PERSONAL_CHOSEN",
          randomUsername: a.random ? pickRandomDisplayUsername(nameWorkType) : null,
          workedThere: workedThere.has(author.id),
          createdAt: new Date(Math.min(Date.now() - 60_000, createdAt.getTime() + minutes * 60_000)),
        },
        select: { id: true },
      });
      answersAdded++;
      const voters = shuffled(others.filter((m) => m.id !== author.id)).slice(0, a.helpful ?? 0);
      if (voters.length > 0) {
        await prisma.socialAnswerVote.createMany({ data: voters.map((v) => ({ answerId: answer.id, userId: v.id })), skipDuplicates: true });
      }
    }
  }

  for (const [i, seed] of CLAIMED.entries()) {
    // Each state goes round the claimed companies from the top, so the dev
    // owner's company has one shown, one hidden and one waiting.
    const sameState = CLAIMED.slice(0, i).filter((s) => s.state === seed.state).length;
    const owner = claimedOrder[sameState % claimedOrder.length];
    await addQuestion(seed, { companyId: owner.companyId, ownerUserId: owner.userId }, seed.state, owner.company.workplaceTypes[0] ?? "OFFICE");
  }
  for (const [i, seed] of UNCLAIMED.entries()) {
    const company = unclaimed[i % Math.max(1, unclaimed.length)];
    if (!company) break;
    await addQuestion(seed, { companyId: company.id, ownerUserId: null }, "PUBLIC", company.workplaceTypes[0] ?? "OFFICE");
  }
  for (const seed of BY_WORK) {
    await addQuestion(seed, { workType: seed.workType, ownerUserId: null }, "PUBLIC", seed.workType);
  }

  console.log(`Added ${pollsAdded} polls, ${questionsAdded} questions and ${answersAdded} answers.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
