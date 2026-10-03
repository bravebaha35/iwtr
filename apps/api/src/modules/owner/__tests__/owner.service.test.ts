import { ConflictException, ForbiddenException } from "@nestjs/common";
import { OwnerService } from "../owner.service";
import type { ReviewsService } from "../../reviews/reviews.service";
import type { EmployerProfileService } from "../../employer-profile/employer-profile.service";

describe("OwnerService.updateMyCompany — workplaceTypes locking", () => {
  function buildService(opts: { currentTypes: string[]; allReviewed: boolean }) {
    const prisma = {
      companyOwner: {
        findUnique: jest.fn().mockResolvedValue({ tier: "FREE", planStatus: "NONE", claimStatus: "APPROVED" }),
      },
      company: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ workplaceTypes: opts.currentTypes }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const reviews = { areAllWorkplaceTypesReviewed: jest.fn().mockResolvedValue(opts.allReviewed) };
    const service = new OwnerService(prisma as any, reviews as unknown as ReviewsService, {} as EmployerProfileService);
    return { service, prisma, reviews };
  }

  it("rejects a workplaceTypes change once both current types have been reviewed", async () => {
    const { service, reviews } = buildService({ currentTypes: ["OFFICE", "SERVICE"], allReviewed: true });

    await expect(
      service.updateMyCompany("user-1", "company-1", { workplaceTypes: ["OFFICE", "MANUAL_LABOUR"] }),
    ).rejects.toThrow(ForbiddenException);
    expect(reviews.areAllWorkplaceTypesReviewed).toHaveBeenCalledWith("company-1", ["OFFICE", "SERVICE"]);
  });

  it("allows a workplaceTypes change when not both current types are reviewed yet", async () => {
    const { service, prisma } = buildService({ currentTypes: ["OFFICE", "SERVICE"], allReviewed: false });

    await service.updateMyCompany("user-1", "company-1", { workplaceTypes: ["OFFICE", "MANUAL_LABOUR"] });
    expect(prisma.company.update).toHaveBeenCalled();
  });

  it("allows saving other fields untouched when workplaceTypes isn't part of the request", async () => {
    const { service, prisma, reviews } = buildService({ currentTypes: ["OFFICE", "SERVICE"], allReviewed: true });

    await service.updateMyCompany("user-1", "company-1", { isHiring: true });
    expect(reviews.areAllWorkplaceTypesReviewed).not.toHaveBeenCalled();
    expect(prisma.company.update).toHaveBeenCalled();
  });
});

describe("OwnerService — banner membership gate (server-side, do not trust the client)", () => {
  function buildService(tier: string, planStatus: string) {
    const prisma = {
      companyOwner: {
        findUnique: jest.fn().mockResolvedValue({ tier, planStatus, claimStatus: "APPROVED" }),
      },
      company: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ workplaceTypes: ["OFFICE"] }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const reviews = { areAllWorkplaceTypesReviewed: jest.fn().mockResolvedValue(false) };
    return { service: new OwnerService(prisma as any, reviews as unknown as ReviewsService, {} as EmployerProfileService), prisma };
  }

  it("rejects a bannerImageUrl change on a FREE tier with the membership message", async () => {
    const { service } = buildService("FREE", "NONE");
    await expect(
      service.updateMyCompany("u1", "c1", { bannerImageUrl: "https://cdn.example.com/b.webp" }),
    ).rejects.toThrow("Membership upgrade required to change banner");
  });

  it("allows a bannerImageUrl change on an ACTIVE BLUE (Starter) tier", async () => {
    const { service, prisma } = buildService("BLUE", "ACTIVE");
    await service.updateMyCompany("u1", "c1", { bannerImageUrl: "https://cdn.example.com/b.webp" });
    expect(prisma.company.update).toHaveBeenCalled();
  });

  it("rejects a bannerImageUrl change on a FREE tier whose plan somehow reads ACTIVE", async () => {
    const { service } = buildService("FREE", "ACTIVE");
    await expect(
      service.updateMyCompany("u1", "c1", { bannerImageUrl: "https://cdn.example.com/b.webp" }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects a bannerImageUrl change on BLUE_PLUS whose plan has lapsed", async () => {
    const { service } = buildService("BLUE_PLUS", "PAST_DUE");
    await expect(
      service.updateMyCompany("u1", "c1", { bannerImageUrl: "https://cdn.example.com/b.webp" }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("allows a bannerImageUrl change on an ACTIVE BLUE_PLUS", async () => {
    const { service, prisma } = buildService("BLUE_PLUS", "ACTIVE");
    await service.updateMyCompany("u1", "c1", { bannerImageUrl: "https://cdn.example.com/b.webp" });
    expect(prisma.company.update).toHaveBeenCalled();
  });

  it("rejects an uploadBanner call from a FREE tier with the membership message", async () => {
    const { service } = buildService("FREE", "NONE");
    await expect(
      service.uploadBanner("u1", "c1", { buffer: Buffer.from("x"), mimetype: "image/webp" } as any),
    ).rejects.toThrow("Membership upgrade required to change banner");
  });
});

describe("OwnerService.updateMyCompany — at least one contact method required", () => {
  function buildService(current: { contactEmail: string | null; contactPhone: string | null }) {
    const prisma = {
      companyOwner: {
        findUnique: jest.fn().mockResolvedValue({ tier: "FREE", planStatus: "NONE", claimStatus: "APPROVED" }),
      },
      company: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ workplaceTypes: ["OFFICE"], ...current }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const reviews = { areAllWorkplaceTypesReviewed: jest.fn().mockResolvedValue(false) };
    return { service: new OwnerService(prisma as any, reviews as unknown as ReviewsService, {} as EmployerProfileService), prisma };
  }

  it("rejects clearing both when the company currently has both set", async () => {
    const { service } = buildService({ contactEmail: "hr@co.com", contactPhone: "+905551234567" });
    await expect(
      service.updateMyCompany("u1", "c1", { contactEmail: "", contactPhone: "" }),
    ).rejects.toThrow("Provide at least a phone number or an email address");
  });

  it("allows setting only an email when phone is left blank and none is stored yet", async () => {
    const { service, prisma } = buildService({ contactEmail: null, contactPhone: null });
    await service.updateMyCompany("u1", "c1", { contactEmail: "hr@co.com", contactPhone: "" });
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ contactEmail: "hr@co.com", contactPhone: null }) }),
    );
  });

  it("allows updating an unrelated field when an email is already stored and phone is untouched", async () => {
    const { service, prisma } = buildService({ contactEmail: "hr@co.com", contactPhone: null });
    await service.updateMyCompany("u1", "c1", { isHiring: true });
    expect(prisma.company.update).toHaveBeenCalled();
    // contactEmail/contactPhone weren't part of this request, so the guard
    // must not have needed (or found) a reason to reject it — confirmed by
    // not reading the row at all, not just by not throwing.
    expect(prisma.company.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("rejects blanking the only stored phone when no email is set and only phone is in the request", async () => {
    const { service } = buildService({ contactEmail: null, contactPhone: "+905551234567" });
    await expect(
      service.updateMyCompany("u1", "c1", { contactPhone: "" }),
    ).rejects.toThrow("Provide at least a phone number or an email address");
  });

  it("allows blanking phone when a stored email covers the requirement, even though phone isn't in the request together with it", async () => {
    const { service, prisma } = buildService({ contactEmail: "hr@co.com", contactPhone: "+905551234567" });
    await service.updateMyCompany("u1", "c1", { contactPhone: "" });
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ contactPhone: null }) }),
    );
  });
});

describe("OwnerService.claimCompany — one owner per company, real name required", () => {
  const input = { firstName: "Ayşe", lastName: "Demir", showNameInMessages: true };

  function buildService(opts: { ownClaim?: object | null; otherOwner?: object | null }) {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "user-1", status: "ACTIVE" }) },
      company: { findUnique: jest.fn().mockResolvedValue({ id: "company-1", slug: "acme", name: "Acme" }) },
      companyOwner: {
        findUnique: jest.fn().mockResolvedValue(opts.ownClaim ?? null),
        findFirst: jest.fn().mockResolvedValue(opts.otherOwner ?? null),
        upsert: jest.fn().mockImplementation(({ create }) =>
          Promise.resolve({ id: "claim-1", tier: "FREE", planStatus: "NONE", createdAt: new Date(), resolvedAt: null, rivalAnalyticsTier: null, ...create }),
        ),
      },
    };
    const employerProfile = { saveClaimantName: jest.fn().mockResolvedValue(undefined) };
    const service = new OwnerService(
      prisma as any,
      {} as ReviewsService,
      employerProfile as unknown as EmployerProfileService,
    );
    return { service, prisma, employerProfile };
  }

  it("refuses a company someone else already owns, saving nothing", async () => {
    const { service, prisma, employerProfile } = buildService({ otherOwner: { id: "owner-2" } });
    await expect(service.claimCompany("user-1", "acme", input)).rejects.toThrow(ConflictException);
    expect(prisma.companyOwner.upsert).not.toHaveBeenCalled();
    expect(employerProfile.saveClaimantName).not.toHaveBeenCalled();
  });

  it("saves the claimant's name and their name-in-messages choice for a new claim", async () => {
    const { service, prisma, employerProfile } = buildService({});
    await service.claimCompany("user-1", "acme", input);
    expect(employerProfile.saveClaimantName).toHaveBeenCalledWith("user-1", "Ayşe", "Demir");
    expect(prisma.companyOwner.upsert.mock.calls[0][0].create).toMatchObject({ claimStatus: "PENDING", showNameInMessages: true });
  });

  it("keeps the tick-box off when the claimant leaves it unticked", async () => {
    const { service, prisma } = buildService({});
    await service.claimCompany("user-1", "acme", { ...input, showNameInMessages: false });
    expect(prisma.companyOwner.upsert.mock.calls[0][0].create).toMatchObject({ showNameInMessages: false });
  });

  it("leaves an already-approved owner untouched", async () => {
    const approved = { id: "claim-1", companyId: "company-1", claimStatus: "APPROVED", tier: "FREE", planStatus: "NONE", createdAt: new Date(), resolvedAt: null, rivalAnalyticsTier: null };
    const { service, prisma } = buildService({ ownClaim: approved });
    await service.claimCompany("user-1", "acme", input);
    expect(prisma.companyOwner.upsert).not.toHaveBeenCalled();
  });
});
