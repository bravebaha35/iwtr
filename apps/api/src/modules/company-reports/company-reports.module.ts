import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminCompanyReportsController, CompanyReportsController } from "./company-reports.controller";
import { CompanyReportsService } from "./company-reports.service";

@Module({
  imports: [AuthModule],
  controllers: [CompanyReportsController, AdminCompanyReportsController],
  providers: [CompanyReportsService],
})
export class CompanyReportsModule {}
