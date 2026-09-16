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
    return { service: new OwnerService(prisma as any, reviews as unknown as ReviewsService), prisma };
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
