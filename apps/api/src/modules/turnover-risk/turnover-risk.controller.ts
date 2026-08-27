import { BadRequestException, Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { workplaceTypeSchema } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { TurnoverPredictionService } from "./turnover-prediction.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class TurnoverRiskController {
  constructor(private readonly turnoverPrediction: TurnoverPredictionService) {}

  // Owner-only (enforced in the service, not here — see
  // requireApprovedOwnership) view of the caller's own company's turnover
  // risk. No public/rival visibility of this at all.
  @Get("my-companies/:companyId/turnover-risk")
  async getRisk(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Query("workplaceType") workplaceTypeRaw: string,
  ) {
    const parsed = workplaceTypeSchema.safeParse(workplaceTypeRaw);
    if (!parsed.success) {
      throw new BadRequestException("workplaceType must be one of OFFICE, HYBRID_REMOTE, SERVICE, MANUAL_LABOUR");
    }
    return this.turnoverPrediction.assessRisk(user.id, companyId, parsed.data);
  }
}
