import { ForbiddenException } from "@nestjs/common";
import { OwnerService } from "../owner.service";
import type { ReviewsService } from "../../reviews/reviews.service";

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
    const service = new OwnerService(prisma as any, reviews as unknown as ReviewsService);
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
    return { service: new OwnerService(prisma as any, reviews as unknown as ReviewsService), prisma };
  }

  it("rejects a bannerImageUrl change on a FREE tier with the membership message", async () => {
    const { service } = buildService("FREE", "NONE");
    await expect(
      service.updateMyCompany("u1", "c1", { bannerImageUrl: "https://cdn.example.com/b.webp" }),
    ).rejects.toThrow("Membership upgrade required to change banner");
  });

  it("rejects a bannerImageUrl change on BLUE (paid, but not a banner tier)", async () => {
    const { service } = buildService("BLUE", "ACTIVE");
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
