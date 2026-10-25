import { Module } from "@nestjs/common";
import { CompanyNarrativeService } from "./company-narrative.service";

@Module({
  providers: [CompanyNarrativeService],
  exports: [CompanyNarrativeService],
})
export class CompanyNarrativeModule {}
