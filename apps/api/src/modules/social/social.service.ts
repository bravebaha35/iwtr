import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { validateSocialImageUpload, type CreateSocialPostInput } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ModerationService } from "../moderation/moderation.service";
import { processSocialImage } from "./social-image.util";

// Local disk, dev-safe - same pattern as OwnerService.uploadLogo. Served at
// /uploads/social/ by main.ts's existing useStaticAssets(cwd/uploads, prefix
// "/uploads/") mount, outside the "v1" API prefix.
const SOCIAL_UPLOADS_DIR = join(process.cwd(), "uploads", "social");

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  async createPost(
    userId: string,
    input: CreateSocialPostInput,
    file: Express.Multer.File | undefined,
  ): Promise<{ id: string }> {
    await this.requireApprovedOwnership(userId, input.companyId);

    if (!file) {
      throw new BadRequestException("Attach a photo to post.");
    }
    const check = validateSocialImageUpload({ mimeType: file.mimetype, sizeBytes: file.buffer.length });
    if (!check.valid) {
      throw new BadRequestException(check.error);
    }

    if (input.caption) {
      const result = this.moderation.checkContent([input.caption]);
      if (result.violates) {
        throw new BadRequestException(
          "That caption looks like it names a person or breaks our content rules - please reword it.",
        );
      }
    }

    const webp = await processSocialImage(file.buffer, file.mimetype);
    await mkdir(SOCIAL_UPLOADS_DIR, { recursive: true });
    const filename = `${randomUUID()}.webp`;
    await writeFile(join(SOCIAL_UPLOADS_DIR, filename), webp);
    const origin = process.env.API_PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 3001}`;
    const imageUrl = `${origin}/uploads/social/${filename}`;

    const post = await this.prisma.socialPost.create({
      data: { companyId: input.companyId, authorUserId: userId, imageUrl, caption: input.caption || null },
      select: { id: true },
    });
    return { id: post.id };
  }

  // Copy of OwnerService's check (not imported - a 6-line guard is not worth
  // a cross-module dependency, and the spec calls this out explicitly).
  private async requireApprovedOwnership(userId: string, companyId: string) {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You are not an approved owner of this company.");
    }
    return ownership;
  }
}
