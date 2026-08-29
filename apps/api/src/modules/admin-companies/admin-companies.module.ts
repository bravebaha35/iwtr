import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { AdminCompaniesController } from "./admin-companies.controller";
import { AdminCompaniesService } from "./admin-companies.service";

@Module({
  imports: [AuthModule, ReviewsModule],
  controllers: [AdminCompaniesController],
  providers: [AdminCompaniesService],
})
export class AdminCompaniesModule {}
