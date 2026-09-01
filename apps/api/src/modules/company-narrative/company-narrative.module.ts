import { Module } from "@nestjs/common";
import { FlagsModule } from "../flags/flags.module";
import { CompanyNarrativeService } from "./company-narrative.service";
import { PatternGeneratorService } from "./pattern-generator.service";

@Module({
  imports: [FlagsModule],
  providers: [CompanyNarrativeService, PatternGeneratorService],
  exports: [CompanyNarrativeService],
})
export class CompanyNarrativeModule {}
