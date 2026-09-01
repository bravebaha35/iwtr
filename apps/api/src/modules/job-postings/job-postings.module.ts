import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ModerationModule } from "../moderation/moderation.module";
import { PaymentsModule } from "../payments/payments.module";
import { JobPostingsController } from "./job-postings.controller";
import { JobPostingsService } from "./job-postings.service";

@Module({
  imports: [AuthModule, ModerationModule, PaymentsModule],
  controllers: [JobPostingsController],
  providers: [JobPostingsService],
  exports: [JobPostingsService],
})
export class JobPostingsModule {}
