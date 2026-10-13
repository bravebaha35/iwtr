import type { Prisma } from "@prisma/client";
import type { SocialRailQuestion, WorkplaceType } from "@iwtr/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { PUBLIC_COMPANY_WHERE } from "../companies/company-visibility";

const RAIL_OPEN_QUESTION_LIMIT = 5;

// A question is public while it is put to a kind of work, or to a company
// that has not been hidden - the same gate as posts.
export const VISIBLE_QUESTION_WHERE: Prisma.SocialQuestionWhereInput = {
  OR: [{ companyId: null }, { company: PUBLIC_COMPANY_WHERE }],
};

// The rail's "Waiting for an answer": the newest questions everyone can see
// that nobody has answered. The same for every visitor, so SocialService builds it into its
// shared, once-a-minute rail lists. Kept in its own file so SocialService can
// use it without importing SocialQuestionsService (which imports it back).
export async function loadOpenQuestionsForRail(prisma: PrismaService): Promise<SocialRailQuestion[]> {
  const rows = await prisma.socialQuestion.findMany({
    where: { ...VISIBLE_QUESTION_WHERE, visibility: "PUBLIC", answers: { none: {} } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: RAIL_OPEN_QUESTION_LIMIT,
    select: { id: true, body: true, workType: true, company: { select: { name: true } } },
  });
  return rows.map((r) => ({
    questionId: r.id,
    body: r.body,
    companyName: r.company?.name ?? null,
    workType: r.workType as WorkplaceType | null,
  }));
}
