import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Get,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JobApplicationsService, MAX_PDF_SIZE_BYTES } from "./job-applications.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class JobApplicationsController {
  constructor(private readonly jobApplications: JobApplicationsService) {}

  @Post("job-postings/:jobPostingId/apply")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_PDF_SIZE_BYTES } }))
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Param("jobPostingId", new ParseUUIDPipe()) jobPostingId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.jobApplications.apply(user.id, user.role, jobPostingId, file);
  }

  @Get("my-companies/:companyId/job-applications")
  list(@CurrentUser() user: AuthenticatedUser, @Param("companyId", new ParseUUIDPipe()) companyId: string) {
    return this.jobApplications.listForCompany(user.id, companyId);
  }

  @Post("my-companies/:companyId/job-applications/:id/mark-viewed")
  markViewed(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.jobApplications.markViewed(user.id, companyId, id);
  }

  // Authenticated, ownership-checked PDF download — replaces the old
  // public-static-mount URL. getPdfFilePath throws (Forbidden/NotFound)
  // before anything is written to `res`, so those still flow through Nest's
  // normal exception filters same as every other route here.
  @Get("my-companies/:companyId/job-applications/:id/pdf")
  async downloadPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const filePath = await this.jobApplications.getPdfFilePath(user.id, companyId, id);
    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(filePath);
  }
}
