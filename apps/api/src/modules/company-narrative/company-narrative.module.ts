import { Module } from "@nestjs/common";
import { CompanyNarrativeService } from "./company-narrative.service";
import { NarrativeGeneratorService } from "./narrative-generator.service";

@Module({
  providers: [CompanyNarrativeService, NarrativeGeneratorService],
  exports: [CompanyNarrativeService],
})
export class CompanyNarrativeModule {}
