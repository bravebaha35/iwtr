import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { imageSize } from "image-size";
import {
  validateLogoFile,
  type AdminCompanySummary,
  type AdminUpdateCompanyInput,
  type Company,
  type CompanySuggestion,
  type LogoUploadResult,
  type MergeCompaniesResult,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { resolveLocation } from "../companies/resolve-location.util";
import { ReviewsService } from "../reviews/reviews.service";

const UPLOADS_DIR = join(process.cwd(), "uploads", "company-logos");

// Every method here is deliberately scoped to the exact same public fields
// CompaniesService.toPublicCompany already exposes (see the shared `select`
// below) — this is the "Anonymity Vault Isolation" shield: nothing in this
// service ever includes a relation that could reach PiiVault or identify a
// reviewer, the same way CompaniesService's admin-facing createByAdmin
// already never has.
const PUBLIC_COMPANY_SELECT = {
  id: true,
  slug: true,
  name: true,
  category: true,
  workplaceTypes: true,
  mainPhotoUrl: true,
  description: true,
  website: true,
  city: true,
  district: true,
  structureType: true,
  region: true,
  isVerifiedBadge: true,
  taxNumber: true,
  isChainStore: true,
  isHiring: true,
  contactEmail: true,
  contactPhone: true,
  facebookUrl: true,
  instagramUrl: true,
  whatsappUrl: true,
  xUrl: true,
} as const;

function normalizeNameKey(rawCompanyName: string): string {
  return rawCompanyName.trim().toLowerCase();
}

@Injectable()
export class AdminCompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
  ) {}

  // Backs both the "Edit Company Data" search box and the two "Merge
  // Duplicates" dropdowns — deliberately a small, id/slug/name/city/
  // district-only shape (AdminCompanySummary), not the full public Company
  // record (the slug is just so the frontend can re-fetch full detail via
  // the existing public GET /companies/:slug when editing, rather than this
  // duplicating that read). Same "safety ceiling, not the expected size"
  // take() pattern as CompaniesService.search — SingleSelectDropdown's own
  // client-side filter needs the full option set up front rather than a
  // per-keystroke server round trip, so this errs high; real pagination is
  // a later step once the directory outgrows it.
  async search(q?: string): Promise<AdminCompanySummary[]> {
    return this.prisma.company.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : {},
      select: { id: true, slug: true, name: true, city: true, district: true },
      orderBy: { name: "asc" },
      take: 2000,
    });
  }

  async update(adminUserId: string, companyId: string, input: AdminUpdateCompanyInput): Promise<Company> {
    const existing = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!existing) {
      throw new NotFoundException("Company not found");
    }

    if (input.name) {
      const existingByName = await this.prisma.company.findFirst({
        where: { name: { equals: input.name, mode: "insensitive" }, id: { not: companyId } },
      });
      if (existingByName) {
        throw new ConflictException(`A company named "${existingByName.name}" already exists.`);
      }
    }

    // Same rule as admin creation/owner editing: a district can't be set
    // without a city, both canonicalized against the real province list.
    const location = input.city !== undefined ? resolveLocation(input.city, input.district) : undefined;

    // Cross-field structureType/region/city consistency can't be validated
    // at the zod layer for a PARTIAL update (a caller touching only e.g.
    // `description` sends neither field) — so it's checked here against the
    // EFFECTIVE values (whatever this call changes, falling back to what's
    // already stored), the same merge-then-validate approach `location`
    // above already uses for city/district.
    const effectiveStructureType = input.structureType ?? existing.structureType;
    const effectiveRegion = input.region !== undefined ? input.region : existing.region;
    const effectiveCity = location !== undefined ? location.city : existing.city;
    if (effectiveStructureType === "CITY_BASED" && !effectiveCity) {
      throw new BadRequestException("A city-based company needs a city.");
    }
    if (effectiveStructureType === "CITY_BASED" && effectiveRegion) {
      throw new BadRequestException("A city-based company can't also have a region.");
    }
    if (effectiveStructureType === "REGION_BASED" && !effectiveRegion) {
      throw new BadRequestException("A region-based company needs a region.");
    }
    if (effectiveStructureType === "REGION_BASED" && effectiveCity) {
      throw new BadRequestException("A region-based company can't also have a city/district.");
    }
    if (effectiveStructureType === "SETTLED" && effectiveRegion) {
      throw new BadRequestException("A settled company can't have a region.");
    }

    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: input.name,
        category: input.category,
        workplaceTypes: input.workplaceTypes,
        mainPhotoUrl: input.mainPhotoUrl,
        description: input.description,
        website: input.website,
        city: location?.city,
        district: location?.district,
        structureType: input.structureType,
        region: input.region,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        facebookUrl: input.facebookUrl,
        instagramUrl: input.instagramUrl,
        whatsappUrl: input.whatsappUrl,
        xUrl: input.xUrl,
        taxNumber: input.taxNumber,
        isChainStore: input.isChainStore,
      },
      select: PUBLIC_COMPANY_SELECT,
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminUserId,
        action: "EDIT",
        targetType: "Company",
        targetId: companyId,
        metadata: { fields: Object.keys(input) },
      },
    });

    return company;
  }

  // Companion to CompaniesController's admin logo upload — deliberately
  // id-less (unlike OwnerService.uploadLogo, which is scoped to an existing
  // owned company): the admin "Create New Company" form needs to upload a
  // logo before the company itself exists yet, so this just returns a URL
  // the same way, for either the create or the edit form to attach.
  async uploadLogo(file: Express.Multer.File | undefined): Promise<LogoUploadResult> {
    if (!file) {
      throw new BadRequestException("No file uploaded.");
    }

    const { width, height } = imageSize(file.buffer);
    const check = validateLogoFile({
      mimeType: file.mimetype,
      sizeBytes: file.buffer.length,
      width: width ?? 0,
      height: height ?? 0,
    });
    if (!check.valid) {
      throw new BadRequestException(check.error);
    }

    await mkdir(UPLOADS_DIR, { recursive: true });
    const filename = `${randomUUID()}.png`;
    await writeFile(join(UPLOADS_DIR, filename), file.buffer);

    const origin = process.env.API_PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 3001}`;
    return { url: `${origin}/uploads/company-logos/${filename}` };
  }

  // "Pending Review Queue": every distinct employer name a worker free-typed
  // that doesn't match a real Company yet (EmploymentHistory.companyId is
  // null), minus whatever an admin already dismissed. Grouped in
  // application code rather than a Prisma groupBy — groupBy groups by exact
  // byte value, which would treat "A101" and "a101" as two different
  // suggestions; CompanySuggestionDismissal already keys on the same
  // normalized nameKey used here, so both sides need to agree on it.
  async listSuggestions(): Promise<CompanySuggestion[]> {
    const [rows, dismissals] = await Promise.all([
      this.prisma.employmentHistory.findMany({
        where: { companyId: null },
        select: { rawCompanyName: true },
        take: 5000,
      }),
      this.prisma.companySuggestionDismissal.findMany({ select: { nameKey: true } }),
    ]);

    const dismissedKeys = new Set(dismissals.map((d) => d.nameKey));
    const byKey = new Map<string, { rawCompanyName: string; workerCount: number }>();
    for (const row of rows) {
      const nameKey = normalizeNameKey(row.rawCompanyName);
      if (!nameKey || dismissedKeys.has(nameKey)) continue;
      const existing = byKey.get(nameKey);
      if (existing) {
        existing.workerCount += 1;
      } else {
        byKey.set(nameKey, { rawCompanyName: row.rawCompanyName.trim(), workerCount: 1 });
      }
    }

    return Array.from(byKey.entries())
      .map(([nameKey, v]) => ({ nameKey, ...v }))
      .sort((a, b) => b.workerCount - a.workerCount || a.rawCompanyName.localeCompare(b.rawCompanyName));
  }

  // "Reject" — dismiss only. Every worker who typed this name keeps their
  // own EmploymentHistory entry exactly as-is; this just hides the name
  // from the queue going forward (see CompanySuggestionDismissal's own doc
  // comment for why this was the deliberate choice over deleting anything).
  async dismissSuggestion(adminUserId: string, rawCompanyName: string): Promise<void> {
    const nameKey = normalizeNameKey(rawCompanyName);
    if (!nameKey) {
      throw new BadRequestException("Nothing to dismiss.");
    }

    await this.prisma.companySuggestionDismissal.upsert({
      where: { nameKey },
      create: { nameKey, dismissedByAdminId: adminUserId },
      update: {},
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminUserId,
        action: "REJECT",
        targetType: "CompanySuggestion",
        targetId: nameKey,
        metadata: { rawCompanyName },
      },
    });
  }

  /**
   * Folds `duplicateId` into `masterId` and deletes the duplicate. Every
   * relation Prisma won't cascade-delete on its own (none of them do — this
   * schema has no onDelete: Cascade anywhere) has to be moved or cleared
   * first, in a single transaction so a failure partway through never
   * leaves the duplicate half-merged:
   *
   *  - EmploymentHistory: reassigned freely (no uniqueness constraint).
   *  - Review: has @@unique([userId, companyId]) — a review can't move if
   *    the same user already reviewed the master. That pairing is rare
   *    (it means one worker free-typed the same employer as two different
   *    directory entries and reviewed both before they were merged) but
   *    real, so the colliding duplicate-side review (and its dependents:
   *    ReviewVote, CompanyReply, ModerationQueueItem) is dropped rather
   *    than merged — never silently overwriting the master's existing
   *    review. Every drop is named in the returned counts and in AuditLog's
   *    metadata for manual follow-up.
   *  - CompanyOwner: same @@unique([userId, companyId]) collision risk. A
   *    colliding duplicate-side ownership (and any Plus subscription state
   *    on it) is deleted rather than merged — two paid subscriptions are
   *    never silently combined.
   *  - OwnerContactMessage / CompanyReply (non-colliding rows): reassigned.
   *  - CompanyAggregateScore: the duplicate's own row is just deleted; the
   *    master's is recomputed fresh afterward via the existing
   *    ReviewsService.recomputeAggregate (never hand-computed here — see
   *    CLAUDE.md's "never written to directly" rule on this table).
   */
  async merge(adminUserId: string, masterId: string, duplicateId: string): Promise<MergeCompaniesResult> {
    const [master, duplicate] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: masterId } }),
      this.prisma.company.findUnique({ where: { id: duplicateId } }),
    ]);
    if (!master || !duplicate) {
      throw new NotFoundException("Both companies must exist to merge them.");
    }

    const [masterReviews, duplicateReviews, masterOwners, duplicateOwners] = await Promise.all([
      this.prisma.review.findMany({ where: { companyId: masterId }, select: { userId: true } }),
      this.prisma.review.findMany({ where: { companyId: duplicateId }, select: { id: true, userId: true } }),
      this.prisma.companyOwner.findMany({ where: { companyId: masterId }, select: { userId: true } }),
      this.prisma.companyOwner.findMany({ where: { companyId: duplicateId }, select: { id: true, userId: true } }),
    ]);
    const masterReviewerIds = new Set(masterReviews.map((r) => r.userId));
    const masterOwnerIds = new Set(masterOwners.map((o) => o.userId));

    const reviewsToDrop = duplicateReviews.filter((r) => masterReviewerIds.has(r.userId)).map((r) => r.id);
    const reviewsToMove = duplicateReviews.filter((r) => !masterReviewerIds.has(r.userId)).map((r) => r.id);
    const ownersToDrop = duplicateOwners.filter((o) => masterOwnerIds.has(o.userId)).map((o) => o.id);

    await this.prisma.$transaction([
      // Dependents of the reviews being dropped, deepest first.
      this.prisma.reviewVote.deleteMany({ where: { reviewId: { in: reviewsToDrop } } }),
      this.prisma.companyReply.deleteMany({ where: { reviewId: { in: reviewsToDrop } } }),
      this.prisma.moderationQueueItem.deleteMany({ where: { reviewId: { in: reviewsToDrop } } }),
      this.prisma.review.deleteMany({ where: { id: { in: reviewsToDrop } } }),

      // Reviews (and their still-live replies) that DO move.
      this.prisma.review.updateMany({ where: { id: { in: reviewsToMove } }, data: { companyId: masterId } }),
      this.prisma.companyReply.updateMany({ where: { reviewId: { in: reviewsToMove } }, data: { companyId: masterId } }),

      // Ownerships: drop colliding ones, move the rest.
      this.prisma.companyOwner.deleteMany({ where: { id: { in: ownersToDrop } } }),
      this.prisma.companyOwner.updateMany({
        where: { companyId: duplicateId, id: { notIn: ownersToDrop } },
        data: { companyId: masterId },
      }),

      // Everything else with no uniqueness constraint to worry about.
      this.prisma.employmentHistory.updateMany({ where: { companyId: duplicateId }, data: { companyId: masterId } }),
      this.prisma.ownerContactMessage.updateMany({ where: { companyId: duplicateId }, data: { companyId: masterId } }),

      // The duplicate's own cached aggregate row — recomputed fresh for the
      // master below, this one is just gone.
      this.prisma.companyAggregateScore.deleteMany({ where: { companyId: duplicateId } }),

      this.prisma.company.delete({ where: { id: duplicateId } }),

      this.prisma.auditLog.create({
        data: {
          actorUserId: adminUserId,
          action: "MERGE",
          targetType: "Company",
          targetId: masterId,
          metadata: {
            mergedDuplicateId: duplicateId,
            mergedDuplicateName: duplicate.name,
            droppedReviewIds: reviewsToDrop,
            droppedOwnerUserIds: duplicateOwners.filter((o) => ownersToDrop.includes(o.id)).map((o) => o.userId),
          },
        },
      }),
    ]);

    await this.reviews.recomputeAggregate(masterId);

    return {
      mergedReviewCount: reviewsToMove.length,
      droppedReviewCount: reviewsToDrop.length,
      droppedOwnerCount: ownersToDrop.length,
    };
  }
}
