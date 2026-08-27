import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FlagsModule } from "../flags/flags.module";
import { TurnoverRiskController } from "./turnover-risk.controller";
import { TurnoverPredictionService } from "./turnover-prediction.service";

@Module({
  imports: [AuthModule, FlagsModule],
  controllers: [TurnoverRiskController],
  providers: [TurnoverPredictionService],
  exports: [TurnoverPredictionService],
})
export class TurnoverRiskModule {}
