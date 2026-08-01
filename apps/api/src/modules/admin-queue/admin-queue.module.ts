import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { PiiVaultModule } from "../pii-vault/pii-vault.module";
import { AdminQueueController } from "./admin-queue.controller";
import { AdminQueueService } from "./admin-queue.service";

@Module({
  imports: [AuthModule, ReviewsModule, PiiVaultModule],
  controllers: [AdminQueueController],
  providers: [AdminQueueService],
})
export class AdminQueueModule {}
