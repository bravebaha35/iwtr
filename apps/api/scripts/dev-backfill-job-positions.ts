// Dev-only: gives every job posting that has no Position yet (created
// before positions existed) one sensible position, guessed from its title
// and kind of work, so the Jobs page's Position filter has something to
// show on the demo data. A real owner picks 1 to 3 positions themselves
// when posting a job - this never touches a posting that already has any.
//
// Run from apps/api: pnpm exec ts-node --transpile-only scripts/dev-backfill-job-positions.ts
import "dotenv/config";
import { PrismaClient, type JobPosition, type WorkplaceType } from "@prisma/client";

const prisma = new PrismaClient();

// Lower-case, Turkish letters folded to plain ones, so one ASCII keyword
// matches "Mudur", "Müdür" and "MÜDÜR" alike.
function fold(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function guess(jobTitle: string, workType: WorkplaceType | null): JobPosition[] {
  const t = fold(jobTitle);
  if (/stajyer|intern/.test(t)) return ["INTERN"];
  if (/genel mudur|direktor|director|chief|\bceo\b|\bcfo\b/.test(t)) return ["SENIOR_EXECUTIVE"];
  if (/mudur yardimcisi|yonetici adayi|trainee/.test(t)) return ["MANAGEMENT_TRAINEE"];
  if (/mudur|yonetici|manager|sorumlu|sef|supervisor/.test(t)) return ["MIDDLE_MANAGER"];
  if (/uzman yardimcisi|asistan|assistant/.test(t)) return ["ASSISTANT_SPECIALIST"];
  if (/uzman|analist|muhendis|specialist|engineer|developer|avukat|muhasebe/.test(t)) return ["SPECIALIST"];
  if (/freelance|serbest/.test(t)) return ["FREELANCER"];
  if (workType === "MANUAL_LABOUR") return ["BLUE_COLLAR"];
  if (workType === "SERVICE") return ["SERVICE_STAFF"];
  return ["STAFF_MEMBER", "ENTRY_LEVEL"];
}

async function main() {
  const postings = await prisma.jobPosting.findMany({
    where: { positions: { isEmpty: true } },
    select: { id: true, jobTitle: true, workType: true },
  });
  for (const p of postings) {
    await prisma.jobPosting.update({ where: { id: p.id }, data: { positions: guess(p.jobTitle, p.workType) } });
  }
  console.log(`Positions set on ${postings.length} job posting(s) that had none.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
