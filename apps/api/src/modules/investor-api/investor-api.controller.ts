import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { workplaceTypeSchema } from "@iwtr/shared-types";
import { InvestorApiKeyGuard } from "./investor-api-key.guard";
import { InvestorApiService } from "./investor-api.service";

@Controller("investor")
@UseGuards(InvestorApiKeyGuard)
export class InvestorApiController {
  constructor(private readonly investorApi: InvestorApiService) {}

  // Strict per-IP ceiling on top of the global default — this is a
  // paid, third-party-facing surface, explicitly called out as needing
  // its own limit to blunt an aggressive polling script or bot, same
  // reasoning as the review-submission/vote endpoints' own tighter tiers.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get("market-report")
  async getMarketReport(
    @Query("province") province: string | undefined,
    @Query("district") district: string | undefined,
    @Query("workplaceType") workplaceTypeRaw: string,
  ) {
    const parsed = workplaceTypeSchema.safeParse(workplaceTypeRaw);
    if (!parsed.success) {
      throw new BadRequestException("workplaceType must be one of OFFICE, HYBRID_REMOTE, SERVICE, MANUAL_LABOUR");
    }
    return this.investorApi.getMarketReport(province, district, parsed.data);
  }
}
