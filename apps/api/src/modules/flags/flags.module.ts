import { Module } from "@nestjs/common";
import { FlagCalculatorService } from "./flag-calculator.service";

@Module({
  providers: [FlagCalculatorService],
  exports: [FlagCalculatorService],
})
export class FlagsModule {}
