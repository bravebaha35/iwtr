import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FlagsModule } from "../flags/flags.module";
import { PaymentsModule } from "../payments/payments.module";
import { TurnoverRiskModule } from "../turnover-risk/turnover-risk.module";
import { BenchmarkReportController } from "./benchmark-report.controller";
import { BenchmarkReportService } from "./benchmark-report.service";
import { BenchmarkReportWorker } from "./benchmark-report.worker";
import { HrAnalyticsReportController } from "./hr-analytics-report.controller";
import { HrAnalyticsReportDataService } from "./hr-analytics-report.data";
import { HrAnalyticsReportService } from "./hr-analytics-report.service";
import { HrAnalyticsReportWorker } from "./hr-analytics-report.worker";
import { SectorBenchmarkService } from "./sector-benchmark.service";

// The owner dashboard's Benchmark Reports: the Sector Benchmark Report and
// the HR Analytics Report. The competitor ("Rival Analytics") report that
// used to live here was removed on 2026-09-27 (product/legal decision); its
// database tables are left untouched.
@Module({
  imports: [AuthModule, TurnoverRiskModule, FlagsModule, PaymentsModule],
  controllers: [BenchmarkReportController, HrAnalyticsReportController],
  providers: [
    SectorBenchmarkService,
    BenchmarkReportService,
    BenchmarkReportWorker,
    HrAnalyticsReportDataService,
    HrAnalyticsReportService,
    HrAnalyticsReportWorker,
  ],
})
export class RivalAnalyticsModule {}
