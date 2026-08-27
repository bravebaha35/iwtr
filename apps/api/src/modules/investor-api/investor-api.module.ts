import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InvestorApiController } from "./investor-api.controller";
import { InvestorApiAdminController } from "./investor-api-admin.controller";
import { InvestorApiService } from "./investor-api.service";
import { InvestorApiKeyGuard } from "./investor-api-key.guard";

@Module({
  imports: [AuthModule],
  controllers: [InvestorApiController, InvestorApiAdminController],
  providers: [InvestorApiService, InvestorApiKeyGuard],
  exports: [InvestorApiService],
})
export class InvestorApiModule {}
