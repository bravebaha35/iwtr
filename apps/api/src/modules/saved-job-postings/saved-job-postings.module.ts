import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SavedJobPostingsController } from "./saved-job-postings.controller";
import { SavedJobPostingsService } from "./saved-job-postings.service";

@Module({
  imports: [AuthModule],
  controllers: [SavedJobPostingsController],
  providers: [SavedJobPostingsService],
})
export class SavedJobPostingsModule {}
