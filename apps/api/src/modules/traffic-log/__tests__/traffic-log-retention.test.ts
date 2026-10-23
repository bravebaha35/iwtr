import { TrafficLogService, trafficLogRetentionDays } from "../traffic-log.service";

describe("trafficLogRetentionDays", () => {
  it("keeps records the full two years when nothing is set", () => {
    expect(trafficLogRetentionDays(undefined)).toBe(730);
    expect(trafficLogRetentionDays("")).toBe(730);
    expect(trafficLogRetentionDays("soon")).toBe(730);
  });

  it("uses a figure inside the legal range as given", () => {
    expect(trafficLogRetentionDays("400")).toBe(400);
  });

  it("never goes below one year or above two", () => {
    expect(trafficLogRetentionDays("30")).toBe(365);
    expect(trafficLogRetentionDays("5000")).toBe(730);
  });
});

describe("TrafficLogService.purgeExpired", () => {
  it("deletes only records older than the retention period", async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 3 });
    const service = new TrafficLogService({ trafficLog: { deleteMany } } as never);
    const now = new Date("2026-10-24T12:00:00Z");

    const count = await service.purgeExpired(now, 365);

    expect(count).toBe(3);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date("2025-10-24T12:00:00Z") } },
    });
  });
});
