import { NotFoundException } from "@nestjs/common";

// Spread into any public Prisma `where` on Company. A hidden company is
// invisible to everyone except an ADMIN and (flagged) its own owner.
export const PUBLIC_COMPANY_WHERE = { hiddenAt: null } as const;

export function assertCompanyVisibleOrThrow(
  company: { hiddenAt: Date | null } | null,
): asserts company is { hiddenAt: null } {
  if (!company || company.hiddenAt !== null) {
    throw new NotFoundException("Company not found");
  }
}
