import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { JobApplicationsController } from "./job-applications.controller";
import { JobApplicationsService } from "./job-applications.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [JobApplicationsController],
  providers: [JobApplicationsService],
})
export class JobApplicationsModule {}
