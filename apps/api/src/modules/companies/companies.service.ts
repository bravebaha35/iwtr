import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AdminCreateCompanyInput, Company, CompanyDetail } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "./slugify.util";

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

    const company = await this.prisma.company.create({
      data: {
        slug,
        name: input.name,
        category: input.category,
        city: input.city,
        mainPhotoUrl: input.mainPhotoUrl,
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

    return this.toPublicCompany(company);
  }

  async search(query: string | undefined): Promise<Company[]> {
    const companies = await this.prisma.company.findMany({
      where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
      orderBy: { name: "asc" },
      take: 25,
    });
    return companies.map((c) => this.toPublicCompany(c));
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
    mainPhotoUrl: string | null;
    description: string | null;
    website: string | null;
    city: string | null;
    isVerifiedBadge: boolean;
  }): Company {
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      category: c.category,
      mainPhotoUrl: c.mainPhotoUrl,
      description: c.description,
      website: c.website,
      city: c.city,
      isVerifiedBadge: c.isVerifiedBadge,
    };
  }
}
