import { NotFoundException } from "@nestjs/common";

// Spread into any public Prisma `where` on Company. A hidden company is
// invisible to everyone except an ADMIN and (flagged) its own owner.
export const PUBLIC_COMPANY_WHERE = { hiddenAt: null } as const;

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
