import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { CompaniesController } from "./companies.controller";
import { CompaniesService } from "./companies.service";

@Module({
  imports: [AuthModule, ReviewsModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
