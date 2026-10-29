import { toJobSalary } from "../job-postings/job-salary.util";
import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import {
  COMPANY_BROWSE_PAGE_SIZE,
  FEATURED_JOBS_LIMIT,
  findProvinceByCityName,
  jobPositionSchema,
  jobsPageCount,
  jobsPageRange,
  workplaceTypeSchema,
  type AdminCreateCompanyInput,
  type ClassifiedJobTitle,
  type Company,
  type CompanyDetail,
  type CompanyFilters,
  type CompanyJobPostings,
  type CompanyListItem,
  type CompanyBrowseQuery,
  type CompanyBrowseResult,
  type EmployerAd,
  type JobPosition,
  type CompanySearchQuery,
  type PublicJobPosting,
  type WorkplaceType,
} from "@iwtr/shared-types";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ReviewsService } from "../reviews/reviews.service";
import { shouldLazyReshare, daysRemaining } from "../job-postings/job-postings.util";
import { HIRING_COMPANY_WHERE, PUBLIC_COMPANY_WHERE, assertCompanyVisibleOrThrow } from "./company-visibility";
import { toPublicCompany } from "./company-public.util";
import { categoryGroupWhere, sortBrowseRows, visibleBrowseRows } from "./company-browse.util";
import { pickFeatured } from "./featured-jobs.util";
import { slugify } from "./slugify.util";
import { resolveLocation } from "./resolve-location.util";
import { classifyJobRole } from "./workplace-classifier/classifyJobRole";
import { WORKPLACE_CATEGORY_MAP } from "./workplace-classifier/workplaceCategories";

// One standard card on the Jobs page: a real posting, an inferred job
// title (a hiring company with no posting of its own), or - with neither -
// the company's "no open roles listed yet" card.
interface JobCardRef {
  companyId: string;
  postingId?: string;
  title?: string;
}

// Every standard card the Jobs page has for one set of filters, in order,
// plus that view's Featured row.
interface JobsIndex {
  cards: JobCardRef[];
  featured: CompanyBrowseResult["featured"];
}

// How long one set of filters keeps its card list. Paging through the Jobs
// page, and everyone looking at the same view in that minute, reuse it
// instead of making the database list every hiring company again.
const JOBS_INDEX_TTL_MS = 60_000;
const JOBS_INDEX_MAX_ENTRIES = 200;

// The homepage grid's sorted list for one set of filters: only ids, kept for
// a minute like the Jobs list. Without it every page view (and every page
// click) made the database list and sort the whole directory again.
interface BrowseIndex {
  ids: string[];
  hiddenUnratedCount: number;
}
const BROWSE_INDEX_TTL_MS = 60_000;
// Fewer than the Jobs list: an unfiltered view holds every company's id.
const BROWSE_INDEX_MAX_ENTRIES = 50;

/** One cache key per set of filters; the page number is not part of it. */
function filterKey(query: CompanyBrowseQuery): string {
  return JSON.stringify(
    Object.entries({ ...query, page: undefined })
      .filter(([, v]) => v !== undefined && v !== "")
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}
// How many company ids one inferred-job-title read takes at a time.
const JOB_TITLE_CHUNK = 2000;

/** The Position filter's values; anything unrecognised is dropped, like workplaceTypes. */
function parsePositions(raw: string | undefined): JobPosition[] {
  if (!raw) return [];
  const known = jobPositionSchema.options as string[];
  return [...new Set(raw.split(",").map((p) => p.trim()))].filter((p): p is JobPosition => known.includes(p));
}

@Injectable()
export class CompaniesService {
  private readonly jobsIndexCache = new Map<string, { at: number; index: Promise<JobsIndex> }>();
  private readonly browseIndexCache = new Map<string, { at: number; index: Promise<BrowseIndex> }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
  ) {}

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
        structureType: input.structureType ?? "SETTLED",
        region: input.region ?? null,
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

    // A freshly-created company has no owner yet.
    return toPublicCompany(company, false);
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
  // The WHERE clause shared by GET /companies (search) and the homepage's
  // GET /companies/browse.
  private buildSearchWhere(query: CompanySearchQuery): Prisma.CompanyWhereInput {
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

    // The Sector tick list: any one of the ticked sectors matches.
    const categories = query.categories
      ? query.categories.split("|").map((c) => c.trim()).filter(Boolean)
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

    return {
      // A hidden company (Company.hiddenAt) is gone from every public
      // surface — the homepage/jobs browser included.
      ...PUBLIC_COMPANY_WHERE,
      ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
      ...(categories.length > 0
        ? { category: { in: categories } }
        : query.category
          ? { category: query.category }
          : {}),
      // hasSome, not has: the sidebar filter is OR semantics across
      // however many types are checked ("Office" or "Service" companies),
      // matching MultiFilterPillGroup's multi-select in WorkplaceBrowser.
      ...(workplaceTypes.length > 0 ? { workplaceTypes: { hasSome: workplaceTypes } } : {}),
      // Companies with no aggregate row yet (zero reviews) naturally
      // fail any minRating filter here, same as the old client-side
      // `c.overallAvg === null` check did — an inner-join-style relation
      // filter excludes them rather than needing an explicit null check.
      ...(query.minRating !== undefined ? { aggregate: { is: { overallAvg: { lte: query.minRating }, reviewCount: { gt: 0 } } } } : {}),
      ...(query.maxRiskScore !== undefined ? { riskScore: { lte: query.maxRiskScore } } : {}),
      // Only the /jobs page sends includeJobTitles, and only it should be
      // scoped to isHiring companies — the rating homepage's plain
      // GET /companies (no flag) keeps returning every company regardless
      // of this toggle, exactly as before this field existed. Only a company
      // with an approved owner can be hiring: isHiring is the owner's switch,
      // and demo seeds once set it on unclaimed companies.
      ...(query.includeJobTitles ? { isHiring: true, owners: { some: { claimStatus: "APPROVED" as const } } } : {}),
      ...locationFilter,
    };
  }

  async search(query: CompanySearchQuery): Promise<CompanyListItem[]> {
    const where = this.buildSearchWhere(query);
    const companies = await this.prisma.company.findMany({
      where,
      // Only overallAvg/reviewCount are ever read off `aggregate` below —
      // narrowed from a full `include: { aggregate: true }` to cut the
      // per-row payload on a query that can return up to `take` rows.
      include: { aggregate: { select: { overallAvg: true, reviewCount: true } } },
      orderBy: { name: "asc" },
      // Safety ceiling, not the expected size — once the directory is large
      // enough that even a fully-filtered result routinely approaches this,
      // real pagination (not just a higher ceiling) is the next step.
      take: 5000,
    });

    const jobTitlesByCompanyId = query.includeJobTitles
      ? await this.jobTitlesByCompanyId(companies.map((c) => c.id))
      : new Map<string, ClassifiedJobTitle[]>();
    const jobPostingsByCompanyId = query.includeJobTitles
      ? await this.jobPostingsByCompanyId(companies.map((c) => c.id))
      : new Map<string, PublicJobPosting[]>();

    // One grouped read of which of these companies have an approved owner —
    // drives the "claimed" check-mark and the colour-vs-greyscale default
    // banner on every browse/job card.
    const ownedCompanyIds = await this.approvedOwnerCompanyIds(companies.map((c) => c.id));

    return companies.map((c) => ({
      ...toPublicCompany(c, ownedCompanyIds.has(c.id)),
      overallAvg: c.aggregate?.reviewCount ? c.aggregate.overallAvg : null,
      reviewCount: c.aggregate?.reviewCount ?? 0,
      jobTitles: jobTitlesByCompanyId.get(c.id) ?? [],
      jobPostings: jobPostingsByCompanyId.get(c.id) ?? [],
    }));
  }

  /**
   * The homepage grid (GET /companies/browse), one page at a time. Same
   * filters as search plus Quick Select, sort and Near Me. A light list of
   * every match (id, name, city, rating) is sorted here; only the requested
   * page's 20 cards are then loaded in full and sent - instead of the whole
   * directory going to the browser.
   */
  async browse(query: CompanyBrowseQuery): Promise<CompanyBrowseResult> {
    if (query.jobs === "1") return this.browseJobs(query);
    const { ids, hiddenUnratedCount } = await this.browseIndex(query);

    const pageSize = COMPANY_BROWSE_PAGE_SIZE;
    // A page past the end (the list shrank since the visitor last looked)
    // lands on the last page rather than an empty one.
    const page = Math.min(query.page ?? 1, Math.max(1, Math.ceil(ids.length / pageSize)));
    const pageIds = ids.slice((page - 1) * pageSize, page * pageSize);

    const items = await this.browseCards(pageIds, false);
    return { items, total: ids.length, page, pageSize, hiddenUnratedCount, featured: [] };
  }

  // The sorted id list for one set of homepage filters, kept for a minute
  // (BROWSE_INDEX_TTL_MS) and shared by everyone looking at the same view.
  private browseIndex(query: CompanyBrowseQuery): Promise<BrowseIndex> {
    const key = filterKey(query);
    const hit = this.browseIndexCache.get(key);
    if (hit && Date.now() - hit.at < BROWSE_INDEX_TTL_MS) return hit.index;

    const index = this.buildBrowseIndex(query);
    this.browseIndexCache.delete(key);
    this.browseIndexCache.set(key, { at: Date.now(), index });
    // A failed build mustn't stay cached.
    index.catch(() => this.browseIndexCache.delete(key));
    while (this.browseIndexCache.size > BROWSE_INDEX_MAX_ENTRIES) {
      this.browseIndexCache.delete(this.browseIndexCache.keys().next().value!);
    }
    return index;
  }

  private async buildBrowseIndex(query: CompanyBrowseQuery): Promise<BrowseIndex> {
    const sort = query.sort ?? "default";
    const matches = await this.prisma.company.findMany({
      where: {
        AND: [
          this.buildSearchWhere({ ...query, includeJobTitles: false }),
          categoryGroupWhere(query.categoryGroup),
          query.companyId ? { id: query.companyId } : {},
        ],
      },
      select: {
        id: true,
        name: true,
        city: true,
        riskScore: true,
        aggregate: { select: { overallAvg: true, reviewCount: true } },
      },
      orderBy: { name: "asc" },
    });
    const rows = sortBrowseRows(
      matches.map((m) => ({
        id: m.id,
        name: m.name,
        city: m.city,
        overallAvg: m.aggregate?.reviewCount ? m.aggregate.overallAvg : null,
        reviewCount: m.aggregate?.reviewCount ?? 0,
        riskScore: m.riskScore,
      })),
      sort,
      query.nearCity,
    );
    const { visible, hiddenUnratedCount } = visibleBrowseRows(rows, { sort, categoryGroup: query.categoryGroup, q: query.q });
    return { ids: visible.map((r) => r.id), hiddenUnratedCount };
  }

  /**
   * The Jobs page (GET /companies/browse?jobs=1), one page of job cards at
   * a time: 4 across and 5 rows, like the homepage. Page 1 gives up to 2 of
   * those rows to the Featured ads (8 featured -> 12 standard cards), every
   * later page holds 20. Each item sent back is one card: the company with
   * the single posting (or inferred job title) that card shows - so a
   * company with three open roles takes three places, and no page comes out
   * longer or shorter than the grid.
   */
  private async browseJobs(query: CompanyBrowseQuery): Promise<CompanyBrowseResult> {
    const index = await this.jobsIndex(query);
    const featuredCount = index.featured.length;
    const totalPages = jobsPageCount(index.cards.length, featuredCount);
    // A page past the end lands on the last page rather than an empty one.
    const page = Math.min(query.page ?? 1, totalPages);
    const { start, size } = jobsPageRange(page, featuredCount);
    const refs = index.cards.slice(start, start + size);

    // Only the companies on this page are loaded in full.
    const companies = await this.browseCards([...new Set(refs.map((r) => r.companyId))], true);
    const companyById = new Map(companies.map((c) => [c.id, c]));
    const items = refs.flatMap((ref): CompanyListItem[] => {
      const company = companyById.get(ref.companyId);
      if (!company) return [];
      if (ref.postingId) {
        // Gone since the list was built (filled, expired, hidden): skip it.
        const posting = company.jobPostings.find((p) => p.id === ref.postingId);
        return posting ? [{ ...company, jobPostings: [posting], jobTitles: [] }] : [];
      }
      if (ref.title !== undefined) {
        const title = company.jobTitles.find((t) => t.title === ref.title);
        return title ? [{ ...company, jobPostings: [], jobTitles: [title] }] : [];
      }
      return [{ ...company, jobPostings: [], jobTitles: [] }];
    });

    return {
      items,
      total: index.cards.length,
      page,
      pageSize: size,
      totalPages,
      hiddenUnratedCount: 0,
      featured: page === 1 ? index.featured : [],
    };
  }

  // The card list for one set of Jobs filters, kept for a minute (see
  // JOBS_INDEX_TTL_MS). The Featured row is picked once with it, so the ads
  // shown in that row are the same ones left out of the standard cards on
  // every page - no job shows twice, and none goes missing between pages.
  private jobsIndex(query: CompanyBrowseQuery): Promise<JobsIndex> {
    const key = filterKey(query);
    const hit = this.jobsIndexCache.get(key);
    if (hit && Date.now() - hit.at < JOBS_INDEX_TTL_MS) return hit.index;

    const index = this.buildJobsIndex(query);
    this.jobsIndexCache.delete(key);
    this.jobsIndexCache.set(key, { at: Date.now(), index });
    // A failed build mustn't stay cached.
    index.catch(() => this.jobsIndexCache.delete(key));
    while (this.jobsIndexCache.size > JOBS_INDEX_MAX_ENTRIES) {
      this.jobsIndexCache.delete(this.jobsIndexCache.keys().next().value!);
    }
    return index;
  }

  private async buildJobsIndex(query: CompanyBrowseQuery): Promise<JobsIndex> {
    const positions = parsePositions(query.positions);
    const companyWhere: Prisma.CompanyWhereInput = {
      AND: [
        // includeJobTitles is what scopes search to hiring companies.
        this.buildSearchWhere({ ...query, includeJobTitles: true }),
        categoryGroupWhere(query.categoryGroup),
        query.companyId ? { id: query.companyId } : {},
      ],
    };
    const postingWhere: Prisma.JobPostingWhereInput = {
      status: "PUBLISHED",
      ...(positions.length > 0 ? { positions: { hasSome: positions } } : {}),
    };

    // Light reads only - ids and the few fields sorting and "is it still
    // live" need. Descriptions and banners are loaded for one page at a time.
    const [matches, postingRows, featured] = await Promise.all([
      this.prisma.company.findMany({
        // Under a Position filter, only companies with such a posting.
        where: positions.length > 0 ? { AND: [companyWhere, { jobPostings: { some: postingWhere } }, HIRING_COMPANY_WHERE] } : companyWhere,
        select: {
          id: true,
          name: true,
          city: true,
          riskScore: true,
          aggregate: { select: { overallAvg: true, reviewCount: true } },
        },
        orderBy: { name: "asc" },
      }),
      this.prisma.jobPosting.findMany({
        where: { company: { AND: [companyWhere, HIRING_COMPANY_WHERE] }, ...postingWhere },
        select: {
          id: true,
          companyId: true,
          status: true,
          createdAt: true,
          lastResharedAt: true,
          filledAt: true,
          autoReshareEnabled: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.featuredJobs(query),
    ]);

    const rows = sortBrowseRows(
      matches.map((m) => ({
        id: m.id,
        name: m.name,
        city: m.city,
        overallAvg: m.aggregate?.reviewCount ? m.aggregate.overallAvg : null,
        reviewCount: m.aggregate?.reviewCount ?? 0,
        riskScore: m.riskScore,
      })),
      query.sort ?? "default",
      query.nearCity,
    );

    // Same "still live" rule as jobPostingsByCompanyId, newest first.
    const livePostingIds = new Map<string, string[]>();
    for (const p of postingRows) {
      if (!shouldLazyReshare(p) && daysRemaining(p) === 0) continue;
      const list = livePostingIds.get(p.companyId) ?? [];
      list.push(p.id);
      livePostingIds.set(p.companyId, list);
    }

    // Hiring companies with no posting of their own show the job titles
    // their past employees held instead - never under a Position filter,
    // since an inferred title has no position.
    const titlesByCompany = new Map<string, ClassifiedJobTitle[]>();
    if (positions.length === 0) {
      const withoutPosting = rows.filter((r) => !livePostingIds.has(r.id)).map((r) => r.id);
      for (let i = 0; i < withoutPosting.length; i += JOB_TITLE_CHUNK) {
        const chunk = await this.jobTitlesByCompanyId(withoutPosting.slice(i, i + JOB_TITLE_CHUNK));
        for (const [companyId, titles] of chunk) titlesByCompany.set(companyId, titles);
      }
    }

    const featuredIds = new Set(featured.map((f) => f.posting.id));
    const cards: JobCardRef[] = [];
    for (const row of rows) {
      const postingIds = livePostingIds.get(row.id);
      if (postingIds) {
        // A posting in the Featured row isn't repeated among the standard cards.
        for (const postingId of postingIds) {
          if (!featuredIds.has(postingId)) cards.push({ companyId: row.id, postingId });
        }
        continue;
      }
      if (positions.length > 0) continue;
      const titles = titlesByCompany.get(row.id) ?? [];
      if (titles.length === 0) cards.push({ companyId: row.id });
      for (const t of titles) cards.push({ companyId: row.id, title: t.title });
    }
    return { cards, featured };
  }

  /**
   * The employer ad space beside the search bar (Rating and Jobs pages): one
   * company running the AD_SPACE_14 package (which buys this space and
   * nothing else), picked at random each time so every buyer gets shown. Null when none is running (the page then shows
   * a placeholder ad).
   */
  async employerAd(): Promise<EmployerAd> {
    const running = await this.prisma.jobPosting.findMany({
      where: {
        company: { ...HIRING_COMPANY_WHERE },
        status: "PUBLISHED",
        boostAdSpace: true,
        boostExpiresAt: { gt: new Date() },
      },
      select: { id: true, companyId: true, createdAt: true, lastResharedAt: true, filledAt: true, autoReshareEnabled: true, status: true },
      take: 200,
    });
    const live = running.filter((p) => shouldLazyReshare(p) || daysRemaining(p) > 0);
    if (live.length === 0) return null;
    const pick = live[Math.floor(Math.random() * live.length)];
    const [company] = await this.browseCards([pick.companyId], true);
    const posting = company?.jobPostings.find((p) => p.id === pick.id);
    return company && posting ? { company, posting } : null;
  }

  // The sidebar location filter as canonical province names and
  // province+district pairs (same resolution as buildSearchWhere).
  private locationFilterParts(query: CompanySearchQuery): { cities: string[]; districts: { city: string; district: string }[] } {
    const cities = (query.cities ?? "")
      .split(",")
      .map((c) => findProvinceByCityName(c.trim())?.name)
      .filter((c): c is string => !!c);
    const districts = (query.districtKeys ?? "")
      .split(",")
      .map((key) => {
        const [provincePart, districtPart] = key.trim().split("::");
        const province = findProvinceByCityName(provincePart);
        return province && districtPart ? { city: province.name, district: districtPart } : null;
      })
      .filter((d): d is { city: string; district: string } => d !== null);
    return { cities, districts };
  }

  // The full cards for the given company ids, in that order.
  private async browseCards(ids: string[], jobs: boolean): Promise<CompanyListItem[]> {
    if (ids.length === 0) return [];
    const [cards, ownedCompanyIds, jobTitlesByCompanyId, jobPostingsByCompanyId] = await Promise.all([
      this.prisma.company.findMany({
        where: { id: { in: ids } },
        include: { aggregate: { select: { overallAvg: true, reviewCount: true } } },
      }),
      this.approvedOwnerCompanyIds(ids),
      jobs ? this.jobTitlesByCompanyId(ids) : new Map<string, ClassifiedJobTitle[]>(),
      jobs ? this.jobPostingsByCompanyId(ids) : new Map<string, PublicJobPosting[]>(),
    ]);
    const cardById = new Map(cards.map((c) => [c.id, c]));
    return ids.flatMap((id) => {
      const c = cardById.get(id);
      if (!c) return [];
      return [
        {
          ...toPublicCompany(c, ownedCompanyIds.has(c.id)),
          overallAvg: c.aggregate?.reviewCount ? c.aggregate.overallAvg : null,
          reviewCount: c.aggregate?.reviewCount ?? 0,
          jobTitles: jobTitlesByCompanyId.get(c.id) ?? [],
          jobPostings: jobPostingsByCompanyId.get(c.id) ?? [],
        },
      ];
    });
  }

  /**
   * The Jobs page's featured row (page 1 only): live postings with an
   * active Featured boost, at most FEATURED_JOBS_LIMIT. The ad-space package
   * (boostAdSpace) buys the employer ad space only, so those postings are
   * left out of this row. Every sidebar filter applies
   * except the location, which pickFeatured handles itself (chosen place
   * first, topped up from the same region when there are fewer than 4).
   * The member's own Sector / kind of work (forSector / forWorkType) decide
   * which ads come first. Shuffled, so every paid boost gets its turn.
   */
  private async featuredJobs(query: CompanyBrowseQuery): Promise<CompanyBrowseResult["featured"]> {
    const positions = parsePositions(query.positions);
    const boosted = await this.prisma.jobPosting.findMany({
      where: {
        company: {
          AND: [
            this.buildSearchWhere({ ...query, cities: undefined, districtKeys: undefined, includeJobTitles: true }),
            categoryGroupWhere(query.categoryGroup),
            query.companyId ? { id: query.companyId } : {},
            HIRING_COMPANY_WHERE,
          ],
        },
        status: "PUBLISHED",
        boostAdSpace: false,
        boostExpiresAt: { gt: new Date() },
        ...(positions.length > 0 ? { positions: { hasSome: positions } } : {}),
      },
      select: {
        id: true,
        companyId: true,
        workType: true,
        createdAt: true,
        lastResharedAt: true,
        filledAt: true,
        autoReshareEnabled: true,
        status: true,
        company: { select: { city: true, district: true, category: true } },
      },
      take: 500,
    });
    const live = boosted
      .filter((p) => shouldLazyReshare(p) || daysRemaining(p) > 0)
      .map((p) => ({ ...p, city: p.company.city, district: p.company.district, category: p.company.category }));
    const { cities, districts } = this.locationFilterParts(query);
    const picked = pickFeatured(live, {
      cities,
      districts,
      forSector: query.forSector,
      forWorkType: query.forWorkType,
      limit: FEATURED_JOBS_LIMIT,
      minLocal: 4,
    });
    const cards = await this.browseCards([...new Set(picked.map((p) => p.companyId))], true);
    const cardById = new Map(cards.map((c) => [c.id, c]));
    return picked.flatMap((p) => {
      const company = cardById.get(p.companyId);
      const posting = company?.jobPostings.find((jp) => jp.id === p.id);
      return company && posting ? [{ company, posting }] : [];
    });
  }

  // Individually-authored postings (job-postings module), as opposed to the
  // auto-classified titles jobTitlesByCompanyId derives from
  // EmploymentHistory above — same includeJobTitles-only population rule.
  private async jobPostingsByCompanyId(companyIds: string[]): Promise<Map<string, PublicJobPosting[]>> {
    if (companyIds.length === 0) return new Map();

    const rows = await this.prisma.jobPosting.findMany({
      // The public /jobs browser is this service's `search` + these postings;
      // `search` already drops hidden companies, but gate the posting read
      // itself too so a hidden company's job cards can never leak here
      // regardless of how the caller built `companyIds`.
      where: { company: { ...HIRING_COMPANY_WHERE }, companyId: { in: companyIds }, status: "PUBLISHED" },
      select: {
        id: true,
        companyId: true,
        jobTitle: true,
        description: true,
        status: true,
        createdAt: true,
        lastResharedAt: true,
        filledAt: true,
        autoReshareEnabled: true,
        workType: true,
        positions: true,
        salaryAmount: true,
        salaryCurrency: true,
        salaryAtInterview: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const staleIds: string[] = [];
    const byCompany = new Map<string, PublicJobPosting[]>();
    for (const row of rows) {
      if (shouldLazyReshare(row)) {
        // Reshare-eligible: treat it as live for this response immediately
        // (matches the semantics below); the actual write is batched once,
        // after the loop, instead of one await per row.
        staleIds.push(row.id);
      } else if (daysRemaining(row) === 0) {
        // Stale and not resharing — gone from the public feed. Still a real
        // row in the DB (no hard deletions) and still visible to the owner
        // dashboard / Saved Posts for their own 30-day grace windows.
        continue;
      }
      const list = byCompany.get(row.companyId) ?? [];
      list.push({
        id: row.id,
        jobTitle: row.jobTitle,
        description: row.description,
        workType: row.workType,
        positions: row.positions ?? [],
        salary: toJobSalary(row),
      });
      byCompany.set(row.companyId, list);
    }
    if (staleIds.length > 0) {
      await this.prisma.jobPosting.updateMany({
        where: { id: { in: staleIds } },
        data: { lastResharedAt: now },
      });
    }
    return byCompany;
  }

  // Which of the given company ids have at least one APPROVED CompanyOwner.
  // One grouped query, never N+1 — the same shape jobTitlesByCompanyId uses.
  private async approvedOwnerCompanyIds(companyIds: string[]): Promise<Set<string>> {
    if (companyIds.length === 0) return new Set();
    const rows = await this.prisma.companyOwner.findMany({
      where: { companyId: { in: companyIds }, claimStatus: "APPROVED" },
      select: { companyId: true },
    });
    return new Set(rows.map((r) => r.companyId));
  }

  // Backs GET /companies/:slug/job-postings — the "Job Postings" tab on a
  // company's profile page. Deliberately the exact same two arrays a /jobs
  // browser card renders for this company (see search + CompanyListItem):
  // owner-authored PUBLISHED postings, plus the auto-classified job-title
  // fallback. Reuses the batched map helpers above with a single id rather
  // than a second query path, so the tab and the /jobs grid can never drift.
  // A hidden company 404s here exactly as it does on every other slug-scoped
  // read (the posting read itself is also PUBLIC_COMPANY_WHERE-gated inside
  // jobPostingsByCompanyId).
  async jobPostingsForSlug(slug: string): Promise<CompanyJobPostings> {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      select: { id: true, hiddenAt: true },
    });
    assertCompanyVisibleOrThrow(company);

    const [postingsByCompany, titlesByCompany] = await Promise.all([
      this.jobPostingsByCompanyId([company.id]),
      this.jobTitlesByCompanyId([company.id]),
    ]);

    return {
      jobPostings: postingsByCompany.get(company.id) ?? [],
      jobTitles: titlesByCompany.get(company.id) ?? [],
    };
  }

  // Backs GET /companies/:slug/job-title-suggestions — the Job Creation
  // Flow's "What are you looking for?" dropdown. Reuses the same Turkish
  // keyword catalog the classifier uses to read EmploymentHistory rows
  // (workplaceCategories.ts), flattened for whichever of the company's own
  // 1-2 workplaceTypes apply, since there's no persisted per-company sector
  // at that finer granularity to key off directly (see JobSector's own
  // comment in workplaceCategories.ts).
  async jobTitleSuggestionsForSlug(slug: string): Promise<string[]> {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      select: { workplaceTypes: true, hiddenAt: true },
    });
    assertCompanyVisibleOrThrow(company);
    const titles = new Set<string>();
    for (const workplaceType of company.workplaceTypes as WorkplaceType[]) {
      for (const group of WORKPLACE_CATEGORY_MAP[workplaceType]) {
        for (const keyword of group.keywords) {
          titles.add(keyword);
        }
      }
    }
    return Array.from(titles).sort((a, b) => a.localeCompare(b));
  }

  // Only ever called for the /jobs page (query.includeJobTitles), never on
  // the rating homepage's plain search — this is real per-row aggregation
  // work (a groupBy plus a classifyJobRole call per distinct title) that the
  // homepage's request shape has no reason to pay for. Reuses
  // EmploymentHistory.jobTitle — the same free-text field a reviewer's own
  // employment entry already carries (see schema.prisma) — rather than a
  // separate job-listing table, per the product decision that a company's
  // job data is never an isolated dataset.
  private async jobTitlesByCompanyId(companyIds: string[]): Promise<Map<string, ClassifiedJobTitle[]>> {
    if (companyIds.length === 0) return new Map();

    const rows = await this.prisma.employmentHistory.groupBy({
      by: ["companyId", "jobTitle"],
      where: { companyId: { in: companyIds }, jobTitle: { not: null } },
      _count: { jobTitle: true },
    });

    const byCompany = new Map<string, { title: string; workType: WorkplaceType; count: number }[]>();
    for (const row of rows) {
      if (!row.companyId || !row.jobTitle) continue;
      // Only "categorized" titles surface here — classifyJobRole returning
      // null (confidenceScore 0, i.e. an unrecognized keyword) means the raw
      // text is too noisy/ambiguous to show as a job title card, same
      // fallback semantics that function already documents.
      const workType = classifyJobRole(row.jobTitle);
      if (workType === null) continue;
      const list = byCompany.get(row.companyId) ?? [];
      list.push({ title: row.jobTitle, workType, count: row._count.jobTitle });
      byCompany.set(row.companyId, list);
    }

    const result = new Map<string, ClassifiedJobTitle[]>();
    for (const [companyId, titles] of byCompany) {
      const topTitles = titles
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)
        .map((t) => ({ title: t.title, workType: t.workType }));
      result.set(companyId, topTitles);
    }
    return result;
  }

  // Distinct city values currently in use, to drive the location picker
  // without hardcoding a fixed option list. workplaceType is a small closed
  // enum, so the client reads it directly from shared-types instead.
  /**
   * Every public company page, for apps/web/src/app/sitemap.ts: just the slug
   * and when its score last changed (a new published review), so the
   * sitemap stays a small response even with thousands of companies.
   */
  async listForSitemap(): Promise<{ slug: string; lastModified: string | null }[]> {
    const rows = await this.prisma.company.findMany({
      where: PUBLIC_COMPANY_WHERE,
      select: { slug: true, aggregate: { select: { updatedAt: true } } },
      orderBy: { slug: "asc" },
    });
    return rows.map((r) => ({ slug: r.slug, lastModified: r.aggregate?.updatedAt.toISOString() ?? null }));
  }

  async listFilters(): Promise<CompanyFilters> {
    const cities = await this.prisma.company.findMany({
      where: { ...PUBLIC_COMPANY_WHERE, city: { not: null } },
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
      include: { aggregate: true, owners: { where: { claimStatus: "APPROVED" }, select: { id: true }, take: 1 } },
    });
    // Subsumes the bare null-check: a hidden company 404s exactly like a
    // non-existent one, so its detail page (and everything slug-scoped that
    // hangs off it) disappears for the public.
    assertCompanyVisibleOrThrow(company);

    const workplaceTypesLocked = await this.reviews.areAllWorkplaceTypesReviewed(
      company.id,
      company.workplaceTypes,
    );

    return {
      company: { ...toPublicCompany(company, company.owners.length > 0), workplaceTypesLocked },
      // A score row left with no reviews behind it is no score at all.
      aggregate: company.aggregate && company.aggregate.reviewCount > 0
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

}
