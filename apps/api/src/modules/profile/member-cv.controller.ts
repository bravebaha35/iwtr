import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  AVATAR_MAX_UPLOAD_FILE_SIZE_BYTES,
  certificateInputSchema,
  referenceInputSchema,
  type CertificateInput,
  type ReferenceInput,
} from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { MemberCvService } from "./member-cv.service";

// Personal routes: none of these is opened to a company login (the guard is
// default-deny for it).
@Controller("me")
@UseGuards(JwtAuthGuard)
export class MemberCvController {
  constructor(private readonly cv: MemberCvService) {}

  @Post("references")
  addReference(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(referenceInputSchema)) body: ReferenceInput,
  ) {
    return this.cv.addReference(user.id, body);
  }

  @Patch("references/:id")
  updateReference(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(referenceInputSchema)) body: ReferenceInput,
  ) {
    return this.cv.updateReference(user.id, id, body);
  }

  @Delete("references/:id")
  async deleteReference(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    await this.cv.deleteReference(user.id, id);
    return { success: true };
  }

  @Post("certificates")
  addCertificate(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(certificateInputSchema)) body: CertificateInput,
  ) {
    return this.cv.addCertificate(user.id, body);
  }

  @Patch("certificates/:id")
  updateCertificate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(certificateInputSchema)) body: CertificateInput,
  ) {
    return this.cv.updateCertificate(user.id, id, body);
  }

  @Delete("certificates/:id")
  async deleteCertificate(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    await this.cv.deleteCertificate(user.id, id);
    return { success: true };
  }

  @Post("cv-photo")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: AVATAR_MAX_UPLOAD_FILE_SIZE_BYTES } }))
  uploadCvPhoto(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    return this.cv.uploadCvPhoto(user.id, file);
  }

  @Delete("cv-photo")
  async removeCvPhoto(@CurrentUser() user: AuthenticatedUser) {
    await this.cv.removeCvPhoto(user.id);
    return { success: true };
  }
}
