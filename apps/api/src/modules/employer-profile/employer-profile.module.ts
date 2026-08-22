import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EmployerProfileController } from "./employer-profile.controller";
import { EmployerProfileService } from "./employer-profile.service";

@Module({
  imports: [AuthModule],
  controllers: [EmployerProfileController],
  providers: [EmployerProfileService],
  exports: [EmployerProfileService],
})
export class EmployerProfileModule {}
