import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TurnoverRiskModule } from "../turnover-risk/turnover-risk.module";
import { BenchmarkReportController } from "./benchmark-report.controller";
import { BenchmarkReportService } from "./benchmark-report.service";
import { BenchmarkReportWorker } from "./benchmark-report.worker";
import { SectorBenchmarkService } from "./sector-benchmark.service";

// Now only the Sector Benchmark Report. The competitor ("Rival Analytics")
// report that used to live here was removed on 2026-09-27 (product/legal
// decision); its database tables are left untouched.
@Module({
  imports: [AuthModule, TurnoverRiskModule],
  controllers: [BenchmarkReportController],
  providers: [SectorBenchmarkService, BenchmarkReportService, BenchmarkReportWorker],
})
export class RivalAnalyticsModule {}
