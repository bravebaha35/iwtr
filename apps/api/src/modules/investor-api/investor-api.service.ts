import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { WorkplaceType } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { aggregateRegionalSentiment } from "./regional-sentiment.util";
import { generateApiKey, hashApiKey } from "./api-key.util";

const NOT_COLLECTED = {
  available: false,
  reason: "iworkedthere.com does not currently collect this data from reviewers.",
} as const;

export interface MarketReport {
  province: string | null;
  district: string | null;
  workplaceType: WorkplaceType;
  sentiment: ReturnType<typeof aggregateRegionalSentiment>;
  salaryExpectations: typeof NOT_COLLECTED;
  requiredPerks: typeof NOT_COLLECTED;
}

@Injectable()
export class InvestorApiService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Only ever touches CompanyAggregateScore (already-aggregated, no
   * individual review or comment ever enters this query) filtered by the
   * requested province/district/workplaceType. Salary and perks are
   * explicitly reported as not-yet-available rather than estimated or
   * fabricated — this platform has no salary/perks field anywhere in its
   * schema to honestly report on yet.
   */
  async getMarketReport(province: string | undefined, district: string | undefined, workplaceType: WorkplaceType): Promise<MarketReport> {
    const scores = await this.prisma.companyAggregateScore.findMany({
      where: {
        company: {
          workplaceTypes: { has: workplaceType },
          ...(province ? { city: province } : {}),
          ...(district ? { district } : {}),
        },
      },
      select: { overallAvg: true, reviewCount: true },
    });

    return {
      province: province ?? null,
      district: district ?? null,
      workplaceType,
      sentiment: aggregateRegionalSentiment(scores),
      salaryExpectations: NOT_COLLECTED,
      requiredPerks: NOT_COLLECTED,
    };
  }

  // Admin-only key issuance — no self-serve signup for this tier yet (see
  // InvestorApiKey's own schema comment). Returns the raw key exactly
  // once; only its hash is ever stored, so this is the only time it's
  // ever retrievable.
  async issueKey(organizationName: string, contactEmail: string): Promise<{ id: string; rawKey: string }> {
    const rawKey = generateApiKey();
    const record = await this.prisma.investorApiKey.create({
      data: { organizationName, contactEmail, keyHash: hashApiKey(rawKey) },
    });
    return { id: record.id, rawKey };
  }

  async revokeKey(id: string): Promise<void> {
    const record = await this.prisma.investorApiKey.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("API key not found");
    if (record.revokedAt) throw new ForbiddenException("This key is already revoked");

    await this.prisma.investorApiKey.update({
      where: { id },
      data: { active: false, revokedAt: new Date() },
    });
  }
}
