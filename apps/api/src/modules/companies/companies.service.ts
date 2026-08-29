import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  findProvinceByCityName,
  workplaceTypeSchema,
  type AdminCreateCompanyInput,
  type Company,
  type CompanyDetail,
  type CompanyFilters,
  type CompanyListItem,
  type CompanySearchQuery,
  type WorkplaceType,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "./slugify.util";
import { resolveLocation } from "./resolve-location.util";

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async createByAdmin(adminUserId: string, input: AdminCreateCompanyInput): Promise<Company> {
    // Company names are the only thing the employment-history matching (both
    // here and in onboarding) keys off of. Two companies sharing a name would
    // make that matching ambiguous — which one does a free-typed employment
    // entry actually belong to? — so names must be unique, case-insensitively.
    const existingByName = await this.prisma.company.findFirst({
      where: { name: { equals: input.name, mode: "insensitive" } },
    });
    if (existingByName) {
      throw new ConflictException(
        `A company named "${existingByName.name}" already exists. Use a distinguishing suffix (e.g. city) if this is a different business.`,
      );
    }

    const baseSlug = slugify(input.name);
    if (!baseSlug) {
      throw new BadRequestException(
        "Company name must contain at least one letter or number that can form a URL slug",
      );
    }

    let slug = baseSlug;
    let suffix = 1;
    while (await this.prisma.company.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const { city, district } = resolveLocation(input.city, input.district);

    const company = await this.prisma.company.create({
      data: {
        slug,
        name: input.name,
        category: input.category,
        workplaceTypes: input.workplaceTypes,
        city,
        district,
        mainPhotoUrl: input.mainPhotoUrl,
        taxNumber: input.taxNumber,
        isChainStore: input.isChainStore ?? false,
        createdByAdminId: adminUserId,
      },
    });

    // Symmetric first-pass matching: link any employment history rows a user
    // already typed in free text before this company existed. Case-insensitive
    // exact match only for now; fuzzy (pg_trgm) backfill is a later hardening
    // step (see plan), not required to unblock the review-eligibility flow.
    await this.prisma.employmentHistory.updateMany({
      where: { companyId: null, rawCompanyName: { equals: input.name, mode: "insensitive" } },
      data: { companyId: company.id },
    });

    // fromSuggestion distinguishes "approved a worker-suggested name out of
    // the admin dashboard's Pending Review Queue" from "created a brand-new
    // listing from scratch" — both run this exact same method (approving a
    // suggestion IS just creating a company with that name), only the
    // AuditLog actionType differs.
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminUserId,
        action: input.fromSuggestion ? "APPROVE" : "CREATE",
        targetType: "Company",
        targetId: company.id,
        metadata: { name: company.name },
      },
    });

    return this.toPublicCompany(company);
  }

  /**
   * All of q/category/workplaceType/city/district/minRating are now real
   * Prisma WHERE clauses — previously only `q` was ever sent by any caller,
   * and WorkplaceBrowser.tsx fetched this entire (up to 5000-row) result and
   * filtered everything else client-side. `cities`/`districtKeys` are
   * resolved through the same shared-types province/district lookup used at
   * write time (CompaniesService.createByAdmin's resolveLocation), so a
   * request for "istanbul" still matches rows stored as "İstanbul" — this
   * also means a legacy row whose city/district drifted before that
   * write-time validation existed can still be found by name/category/type
   * filters even if its location string itself doesn't match anything.
   */
  async search(query: CompanySearchQuery): Promise<CompanyListItem[]> {
    const cities = query.cities ? query.cities.split(",").map((c) => c.trim()).filter(Boolean) : [];
    const districtKeys = query.districtKeys
      ? query.districtKeys.split(",").map((k) => k.trim()).filter(Boolean)
      : [];
    // Unrecognized tokens are dropped rather than rejected — a stale client
    // sending a since-removed workplace type shouldn't 400 the whole search.
    const workplaceTypes = query.workplaceTypes
      ? query.workplaceTypes
          .split(",")
          .map((t) => t.trim())
          .filter((t): t is WorkplaceType => (workplaceTypeSchema.options as string[]).includes(t))
      : [];

    const canonicalCities = cities
      .map((c) => findProvinceByCityName(c)?.name)
      .filter((c): c is string => c !== undefined);

    const districtPairs = districtKeys
      .map((key) => {
        const [provincePart, districtPart] = key.split("::");
        const province = findProvinceByCityName(provincePart);
        return province && districtPart ? { city: province.name, district: districtPart } : null;
      })
      .filter((p): p is { city: string; district: string } => p !== null);

    // Matches WorkplaceBrowser's prior client-side semantics exactly:
    // selecting a whole province matches every company in it regardless of
    // district; selecting a specific district narrows to just that district.
    // The two lists are OR'd together, same as before.
    //
    // Gated on the RAW requested lists (cities/districtKeys), not the
    // resolved ones (canonicalCities/districtPairs) — if a caller asked for
    // a location filter but nothing in it resolved to a real place (e.g. a
    // typo'd city name), the correct result is zero matches, not silently
    // falling back to "no location filter at all" and returning everything.
    // An empty `OR: []` correctly means "match nothing" in Prisma, so this
    // falls out naturally as long as the gate checks the right list.
    const locationFilter =
      cities.length > 0 || districtKeys.length > 0
        ? {
            OR: [
              ...(canonicalCities.length > 0 ? [{ city: { in: canonicalCities } }] : []),
              ...districtPairs.map((p) => ({ city: p.city, district: p.district })),
            ],
          }
        : {};

    const companies = await this.prisma.company.findMany({
      where: {
        ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
        ...(query.category ? { category: query.category } : {}),
        // hasSome, not has: the sidebar filter is OR semantics across
        // however many types are checked ("Office" or "Service" companies),
        // matching MultiFilterPillGroup's multi-select in WorkplaceBrowser.
        ...(workplaceTypes.length > 0 ? { workplaceTypes: { hasSome: workplaceTypes } } : {}),
        // Companies with no aggregate row yet (zero reviews) naturally
        // fail any minRating filter here, same as the old client-side
        // `c.overallAvg === null` check did — an inner-join-style relation
        // filter excludes them rather than needing an explicit null check.
        ...(query.minRating !== undefined ? { aggregate: { is: { overallAvg: { lte: query.minRating } } } } : {}),
        ...locationFilter,
      },
      include: { aggregate: true },
      orderBy: { name: "asc" },
      // Safety ceiling, not the expected size — once the directory is large
      // enough that even a fully-filtered result routinely approaches this,
      // real pagination (not just a higher ceiling) is the next step.
      take: 5000,
    });
    return companies.map((c) => ({
      ...this.toPublicCompany(c),
      overallAvg: c.aggregate?.overallAvg ?? null,
      reviewCount: c.aggregate?.reviewCount ?? 0,
    }));
  }

  // Distinct city values currently in use, to drive the location picker
  // without hardcoding a fixed option list. workplaceType is a small closed
  // enum, so the client reads it directly from shared-types instead.
  async listFilters(): Promise<CompanyFilters> {
    const cities = await this.prisma.company.findMany({
      where: { city: { not: null } },
      distinct: ["city"],
      select: { city: true },
      orderBy: { city: "asc" },
    });
    return {
      cities: cities.map((c) => c.city).filter((c): c is string => c !== null),
    };
  }

  async getBySlug(slug: string): Promise<CompanyDetail> {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      include: { aggregate: true },
    });
    if (!company) {
      throw new NotFoundException("Company not found");
    }

    return {
      company: this.toPublicCompany(company),
      aggregate: company.aggregate
        ? {
            companyId: company.aggregate.companyId,
            overallAvg: company.aggregate.overallAvg,
            corporateCultureAvg: company.aggregate.corporateCultureAvg,
            leadershipAvg: company.aggregate.leadershipAvg,
            infrastructureAvg: company.aggregate.infrastructureAvg,
            workLifeBalanceAvg: company.aggregate.workLifeBalanceAvg,
            stabilityAvg: company.aggregate.stabilityAvg,
            reviewCount: company.aggregate.reviewCount,
          }
        : null,
    };
  }

  private toPublicCompany(c: {
    id: string;
    slug: string;
    name: string;
    category: string;
    workplaceTypes: WorkplaceType[];
    mainPhotoUrl: string | null;
    description: string | null;
    website: string | null;
    city: string | null;
    district: string | null;
    isVerifiedBadge: boolean;
    taxNumber: string | null;
    isChainStore: boolean;
    contactEmail: string | null;
    contactPhone: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    whatsappUrl: string | null;
    xUrl: string | null;
  }): Company {
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      category: c.category,
      workplaceTypes: c.workplaceTypes,
      mainPhotoUrl: c.mainPhotoUrl,
      description: c.description,
      website: c.website,
      city: c.city,
      district: c.district,
      isVerifiedBadge: c.isVerifiedBadge,
      taxNumber: c.taxNumber,
      isChainStore: c.isChainStore,
      contactEmail: c.contactEmail,
      contactPhone: c.contactPhone,
      facebookUrl: c.facebookUrl,
      instagramUrl: c.instagramUrl,
      whatsappUrl: c.whatsappUrl,
      xUrl: c.xUrl,
    };
  }
}
