import { NotFoundException } from "@nestjs/common";

// Spread into any public Prisma `where` on Company. A hidden company is
// invisible to everyone except an ADMIN and (flagged) its own owner.
export const PUBLIC_COMPANY_WHERE = { hiddenAt: null } as const;

// Spread into the `company` filter of any public JobPosting read. Only an
// approved owner can post a job (JobPostingsService.requireApprovedOwnership),
// so a posting on a company with no approved owner should not exist - but
// demo seed scripts once wrote some straight into the database, and an owner
// can lose a company later. Such postings are never shown publicly.
export const HIRING_COMPANY_WHERE = {
  ...PUBLIC_COMPANY_WHERE,
  owners: { some: { claimStatus: "APPROVED" } },
} as const;

// Accepts a company row (or null). Throws NotFoundException if the row is
// missing OR hidden. Generic so the caller keeps the row's full type after
// the assertion. `hiddenAt` may be absent from the object entirely (a partial
// `select` that didn't ask for it, or a test mock) — that counts as visible;
// only a truthy `hiddenAt` (a real Date) means hidden.
export function assertCompanyVisibleOrThrow<T extends { hiddenAt?: Date | null }>(
  company: T | null,
): asserts company is T {
  if (!company || company.hiddenAt) {
    throw new NotFoundException("Company not found");
  }
}
