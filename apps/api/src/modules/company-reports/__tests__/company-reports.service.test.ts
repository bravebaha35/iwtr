import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { CompanyReportsService } from "../company-reports.service";

// Minimal in-memory CompanyReport table, enough to assert on what an admin would see.
function setup(opts: { owners?: { userId: string; companyId: string; claimStatus: string }[] } = {}) {
  const companies = [
    { id: "c1", name: "Demo Finans Holding", slug: "demo-finans-holding" },
    { id: "c2", name: "Demo Lojistik", slug: "demo-lojistik" },
  ];
  const owners = opts.owners ?? [];
  const rows: { companyId: string; reporterId: string; reason: string; createdAt: Date; dismissedAt: Date | null }[] = [];
  let clock = 0;
  const prisma: any = {
    company: { findUnique: async ({ where }: any) => companies.find((c) => c.id === where.id) ?? null },
    companyOwner: {
      findUnique: async ({ where }: any) =>
        owners.find((o) => o.userId === where.userId_companyId.userId && o.companyId === where.userId_companyId.companyId) ?? null,
    },
    companyReport: {
      upsert: async ({ where, create, update }: any) => {
        const key = where.companyId_reporterId;
        const existing = rows.find((r) => r.companyId === key.companyId && r.reporterId === key.reporterId);
        if (existing) Object.assign(existing, update, { createdAt: new Date(++clock) });
        else rows.push({ ...create, createdAt: new Date(++clock), dismissedAt: null });
      },
      findMany: async () =>
        rows
          .filter((r) => r.dismissedAt === null)
          .map((r) => ({ reason: r.reason, createdAt: r.createdAt, company: companies.find((c) => c.id === r.companyId) })),
      updateMany: async ({ where, data }: any) => {
        const hit = rows.filter((r) => r.companyId === where.companyId && r.dismissedAt === null);
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
    },
  };
  return { service: new CompanyReportsService(prisma), rows };
}

describe("CompanyReportsService", () => {
  it("groups open reports per company with a count per reason, most-reported first", async () => {
    const { service } = setup();
    await service.report("u1", "c1", { reason: "SCAM" });
    await service.report("u2", "c1", { reason: "SCAM" });
    await service.report("u3", "c1", { reason: "WRONG_INFORMATION" });
    await service.report("u1", "c2", { reason: "FAKE_OR_DUPLICATE" });
    const queue = await service.listOpen();
    expect(queue.map((q) => q.companyName)).toEqual(["Demo Finans Holding", "Demo Lojistik"]);
    expect(queue[0]).toEqual(expect.objectContaining({ reportCount: 3, reasonCounts: { SCAM: 2, WRONG_INFORMATION: 1 } }));
    expect(JSON.stringify(queue)).not.toContain("u1");
  });

  it("keeps one report per member, updating the reason when they report again", async () => {
    const { service } = setup();
    await service.report("u1", "c1", { reason: "SCAM" });
    await service.report("u1", "c1", { reason: "OFFENSIVE_CONTENT" });
    const [entry] = await service.listOpen();
    expect(entry).toEqual(expect.objectContaining({ reportCount: 1, reasonCounts: { OFFENSIVE_CONTENT: 1 } }));
  });

  it("dismissing clears the company from the queue until someone reports it again", async () => {
    const { service } = setup();
    await service.report("u1", "c1", { reason: "SCAM" });
    expect(await service.dismiss("c1")).toEqual({ dismissed: 1 });
    expect(await service.listOpen()).toEqual([]);
    await service.report("u1", "c1", { reason: "SCAM" });
    expect(await service.listOpen()).toHaveLength(1);
  });

  it("refuses a report on a missing company or from the company's own owner", async () => {
    const { service } = setup({ owners: [{ userId: "owner", companyId: "c1", claimStatus: "APPROVED" }] });
    await expect(service.report("u1", "nope", { reason: "SCAM" })).rejects.toThrow(NotFoundException);
    await expect(service.report("owner", "c1", { reason: "SCAM" })).rejects.toThrow(ForbiddenException);
  });
});
