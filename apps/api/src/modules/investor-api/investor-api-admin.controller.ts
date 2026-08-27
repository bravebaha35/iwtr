import { Body, Controller, Delete, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { InvestorApiService } from "./investor-api.service";

const issueKeyInputSchema = z.object({
  organizationName: z.string().min(1),
  contactEmail: z.string().email(),
});
type IssueKeyInput = z.infer<typeof issueKeyInputSchema>;

// Admin-only — no self-serve signup for Investor API access yet.
@Controller("admin/investor-api-keys")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class InvestorApiAdminController {
  constructor(private readonly investorApi: InvestorApiService) {}

  @Post()
  issueKey(@Body(new ZodValidationPipe(issueKeyInputSchema)) body: IssueKeyInput) {
    return this.investorApi.issueKey(body.organizationName, body.contactEmail);
  }

  @Delete(":id")
  revokeKey(@Param("id") id: string) {
    return this.investorApi.revokeKey(id);
  }
}
