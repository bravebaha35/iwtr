import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import DOMPurify from "isomorphic-dompurify";
import { imageSize } from "image-size";
import {
  MAX_CERTIFICATES_PER_MEMBER,
  MAX_REFERENCES_PER_MEMBER,
  validateAvatarPhotoFile,
  type AvatarPhotoUploadResult,
  type CertificateInput,
  type MemberCertificate,
  type MemberReference,
  type ReferenceInput,
} from "@iwtr/shared-types";
import type { MemberCertificate as CertificateRow, MemberReference as ReferenceRow } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { removeReplacedUpload } from "../../common/uploads/remove-replaced-upload";

const CV_PHOTO_FOLDER = "cv-photos";
const UPLOADS_DIR = join(process.cwd(), "uploads", CV_PHOTO_FOLDER);

// Plain text only: everything here is printed as text, never as HTML.
function plain(value: string): string {
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [] }).trim();
}

export function toReference(row: ReferenceRow): MemberReference {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    position: row.position,
    email: row.email,
    phoneNumber: row.phoneNumber,
  };
}

export function toCertificate(row: CertificateRow): MemberCertificate {
  return {
    id: row.id,
    name: row.name,
    issuer: row.issuer,
    issuedMonth: row.issuedMonth,
    description: row.description,
  };
}

/**
 * The parts of a member's CV that live in their own tables: references from
 * past jobs, certificates, and the CV photo. All of it is the member's own
 * and goes out only inside the CV they send when applying to a job.
 */
@Injectable()
export class MemberCvService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireActiveMember(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { status: true } });
    if (user.status !== "ACTIVE") {
      throw new ForbiddenException("Complete onboarding before editing your profile");
    }
  }

  // --- References ---------------------------------------------------------

  private referenceData(input: ReferenceInput) {
    return {
      firstName: plain(input.firstName),
      lastName: plain(input.lastName),
      position: input.position,
      email: input.email === "" ? null : input.email,
      phoneNumber: input.phoneNumber === "" ? null : input.phoneNumber,
    };
  }

  async addReference(userId: string, input: ReferenceInput): Promise<MemberReference> {
    await this.requireActiveMember(userId);
    const count = await this.prisma.memberReference.count({ where: { userId } });
    if (count >= MAX_REFERENCES_PER_MEMBER) {
      throw new BadRequestException(`You can add up to ${MAX_REFERENCES_PER_MEMBER} references.`);
    }
    const row = await this.prisma.memberReference.create({ data: { userId, ...this.referenceData(input) } });
    return toReference(row);
  }

  async updateReference(userId: string, id: string, input: ReferenceInput): Promise<MemberReference> {
    await this.requireActiveMember(userId);
    const existing = await this.prisma.memberReference.findUnique({ where: { id }, select: { userId: true } });
    if (!existing || existing.userId !== userId) throw new NotFoundException("Reference not found");
    const row = await this.prisma.memberReference.update({ where: { id }, data: this.referenceData(input) });
    return toReference(row);
  }

  async deleteReference(userId: string, id: string): Promise<void> {
    await this.requireActiveMember(userId);
    const { count } = await this.prisma.memberReference.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException("Reference not found");
  }

  // --- Certificates -------------------------------------------------------

  private certificateData(input: CertificateInput) {
    const description = plain(input.description ?? "");
    return {
      name: plain(input.name),
      issuer: plain(input.issuer),
      issuedMonth: input.issuedMonth,
      description: description === "" ? null : description,
    };
  }

  async addCertificate(userId: string, input: CertificateInput): Promise<MemberCertificate> {
    await this.requireActiveMember(userId);
    const count = await this.prisma.memberCertificate.count({ where: { userId } });
    if (count >= MAX_CERTIFICATES_PER_MEMBER) {
      throw new BadRequestException(`You can add up to ${MAX_CERTIFICATES_PER_MEMBER} certificates.`);
    }
    const row = await this.prisma.memberCertificate.create({ data: { userId, ...this.certificateData(input) } });
    return toCertificate(row);
  }

  async updateCertificate(userId: string, id: string, input: CertificateInput): Promise<MemberCertificate> {
    await this.requireActiveMember(userId);
    const existing = await this.prisma.memberCertificate.findUnique({ where: { id }, select: { userId: true } });
    if (!existing || existing.userId !== userId) throw new NotFoundException("Certificate not found");
    const row = await this.prisma.memberCertificate.update({ where: { id }, data: this.certificateData(input) });
    return toCertificate(row);
  }

  async deleteCertificate(userId: string, id: string): Promise<void> {
    await this.requireActiveMember(userId);
    const { count } = await this.prisma.memberCertificate.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException("Certificate not found");
  }

  // --- CV photo -----------------------------------------------------------

  // The client crops and compresses to a JPEG first (same flow as the
  // employer photo); the size and shape are checked again here from the file
  // itself. The URL is never taken from the client, so it can only ever
  // point at a file this API wrote.
  async uploadCvPhoto(userId: string, file: Express.Multer.File | undefined): Promise<AvatarPhotoUploadResult> {
    await this.requireActiveMember(userId);
    if (!file) throw new BadRequestException("No file uploaded.");

    const { width, height } = imageSize(file.buffer);
    const check = validateAvatarPhotoFile({
      mimeType: file.mimetype,
      sizeBytes: file.buffer.length,
      width: width ?? 0,
      height: height ?? 0,
    });
    if (!check.valid) throw new BadRequestException(check.error);

    await mkdir(UPLOADS_DIR, { recursive: true });
    const filename = `${randomUUID()}.jpg`;
    await writeFile(join(UPLOADS_DIR, filename), file.buffer);
    const origin = process.env.API_PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 3001}`;
    const url = `${origin}/uploads/${CV_PHOTO_FOLDER}/${filename}`;

    const before = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { cvPhotoUrl: true } });
    await this.prisma.user.update({ where: { id: userId }, data: { cvPhotoUrl: url } });
    await removeReplacedUpload(before.cvPhotoUrl, url, CV_PHOTO_FOLDER, async () => false);
    return { url };
  }

  async removeCvPhoto(userId: string): Promise<void> {
    await this.requireActiveMember(userId);
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { cvPhotoUrl: true } });
    if (!before.cvPhotoUrl) return;
    await this.prisma.user.update({ where: { id: userId }, data: { cvPhotoUrl: null } });
    await removeReplacedUpload(before.cvPhotoUrl, null, CV_PHOTO_FOLDER, async () => false);
  }
}
