import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FollowsService } from "../follows.service";

describe("FollowsService.toggleCompanyFollow", () => {
  const visibleCompany = { id: "c1", hiddenAt: null };

  it("follows then unfollows (toggle)", async () => {
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue(visibleCompany) },
      companyFollow: {
        findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "f1" }),
        create: jest.fn().mockResolvedValue({ id: "f1" }),
        delete: jest.fn().mockResolvedValue({ id: "f1" }),
      },
    } as never;
    const service = new FollowsService(prisma);

    const r1 = await service.toggleCompanyFollow("u1", "c1");
    expect(r1).toEqual({ companyId: "c1", following: true });
    expect((prisma as any).companyFollow.create).toHaveBeenCalledWith({ data: { userId: "u1", companyId: "c1" } });

    const r2 = await service.toggleCompanyFollow("u1", "c1");
    expect(r2).toEqual({ companyId: "c1", following: false });
  });

  it("404s on an unknown company", async () => {
    const prisma = { company: { findUnique: jest.fn().mockResolvedValue(null) } } as never;
    await expect(new FollowsService(prisma).toggleCompanyFollow("u1", "ghost")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("404s on a hidden company", async () => {
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue({ id: "c1", hiddenAt: new Date() }) },
    } as never;
    await expect(new FollowsService(prisma).toggleCompanyFollow("u1", "c1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("swallows a concurrent-follow P2002 and reports now-following", async () => {
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue(visibleCompany) },
      companyFollow: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }),
        ),
      },
    } as never;
    const r = await new FollowsService(prisma).toggleCompanyFollow("u1", "c1");
    expect(r).toEqual({ companyId: "c1", following: true });
  });

  it("swallows a concurrent-unfollow P2025 and reports now-not-following", async () => {
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue(visibleCompany) },
      companyFollow: {
        findUnique: jest.fn().mockResolvedValue({ id: "f1" }),
        delete: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError("gone", { code: "P2025", clientVersion: "x" }),
        ),
      },
    } as never;
    const r = await new FollowsService(prisma).toggleCompanyFollow("u1", "c1");
    expect(r).toEqual({ companyId: "c1", following: false });
  });

  it("rethrows a non-P2002 create error", async () => {
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue(visibleCompany) },
      companyFollow: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError("fk", { code: "P2003", clientVersion: "x" }),
        ),
      },
    } as never;
    await expect(new FollowsService(prisma).toggleCompanyFollow("u1", "c1")).rejects.toThrow();
  });
});

describe("FollowsService.listFollowedCompanies", () => {
  it("scopes the query to the caller's own userId and excludes hidden companies", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        company: { id: "c1", name: "Acme", slug: "acme", mainPhotoUrl: null, badgeTier: "FREE" },
      },
    ]);
    const prisma = { companyFollow: { findMany } } as never;
    const result = await new FollowsService(prisma).listFollowedCompanies("u1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "u1", company: { hiddenAt: null } }) }),
    );
    expect(result).toEqual([{ companyId: "c1", companyName: "Acme", companySlug: "acme", mainPhotoUrl: null, badgeTier: "FREE" }]);
  });
});

describe("FollowsService.companyFollowerCount", () => {
  it("returns a bare integer for an approved owner of that company", async () => {
    const prisma = {
      companyOwner: { findUnique: jest.fn().mockResolvedValue({ claimStatus: "APPROVED" }) },
      companyFollow: { count: jest.fn().mockResolvedValue(42) },
    } as never;
    const result = await new FollowsService(prisma).companyFollowerCount("owner-1", "c1");
    expect(result).toEqual({ count: 42 });
    // SECURITY: the response must be exactly { count }, nothing else -
    // in particular no follower list/ids anywhere on the returned object.
    expect(Object.keys(result)).toEqual(["count"]);
  });

  it("403s a caller who has no CompanyOwner row for this company", async () => {
    const prisma = {
      companyOwner: { findUnique: jest.fn().mockResolvedValue(null) },
    } as never;
    await expect(new FollowsService(prisma).companyFollowerCount("u1", "c1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("403s an owner whose claim on this company isn't APPROVED yet", async () => {
    const prisma = {
      companyOwner: { findUnique: jest.fn().mockResolvedValue({ claimStatus: "PENDING" }) },
    } as never;
    await expect(new FollowsService(prisma).companyFollowerCount("owner-1", "c1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("never calls companyFollow.findMany (only .count) - no code path can return a follower list", async () => {
    const findManySpy = jest.fn();
    const prisma = {
      companyOwner: { findUnique: jest.fn().mockResolvedValue({ claimStatus: "APPROVED" }) },
      companyFollow: { count: jest.fn().mockResolvedValue(0), findMany: findManySpy },
    } as never;
    await new FollowsService(prisma).companyFollowerCount("owner-1", "c1");
    expect(findManySpy).not.toHaveBeenCalled();
  });
});

describe("FollowsService.toggleUserFollow", () => {
  it("follows then unfollows another MEMBER (toggle)", async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: "u2", role: "MEMBER" }) },
      userFollow: {
        findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "uf1" }),
        create: jest.fn().mockResolvedValue({ id: "uf1" }),
        delete: jest.fn().mockResolvedValue({ id: "uf1" }),
      },
    } as never;
    const service = new FollowsService(prisma);

    const r1 = await service.toggleUserFollow("u1", "u2");
    expect(r1).toEqual({ userId: "u2", following: true });

    const r2 = await service.toggleUserFollow("u1", "u2");
    expect(r2).toEqual({ userId: "u2", following: false });
  });

  it("rejects following yourself with a 400, before any query", async () => {
    const findUnique = jest.fn();
    const prisma = { user: { findUnique } } as never;
    await expect(new FollowsService(prisma).toggleUserFollow("u1", "u1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("404s on a nonexistent target user", async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } } as never;
    await expect(new FollowsService(prisma).toggleUserFollow("u1", "ghost")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("404s a target who is a COMPANY_OWNER, not a MEMBER (employee-only graph)", async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: "u2", role: "COMPANY_OWNER" }) },
    } as never;
    await expect(new FollowsService(prisma).toggleUserFollow("u1", "u2")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("404s a target who is an ADMIN", async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: "u2", role: "ADMIN" }) },
    } as never;
    await expect(new FollowsService(prisma).toggleUserFollow("u1", "u2")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("swallows a concurrent-follow P2002 and reports now-following", async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: "u2", role: "MEMBER" }) },
      userFollow: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }),
        ),
      },
    } as never;
    const r = await new FollowsService(prisma).toggleUserFollow("u1", "u2");
    expect(r).toEqual({ userId: "u2", following: true });
  });
});
