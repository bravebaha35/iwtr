import { REFRESH_TOKEN_PURGE_GRACE_MS, RefreshTokenPurgeWorker } from "../refresh-token-purge.worker";

describe("RefreshTokenPurgeWorker", () => {
  it("deletes only tokens expired for more than the grace period, revoked or not", async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 3 });
    const worker = new RefreshTokenPurgeWorker({ refreshToken: { deleteMany } } as never);
    const now = new Date("2026-10-29T12:00:00Z");

    await expect(worker.tick(now)).resolves.toBe(3);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: new Date(now.getTime() - REFRESH_TOKEN_PURGE_GRACE_MS) } },
    });
    // A revoked but unexpired token must survive: it is the replay tripwire.
    const where = deleteMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("revokedAt");
  });

  it("never throws when the database fails", async () => {
    const deleteMany = jest.fn().mockRejectedValue(new Error("db down"));
    const worker = new RefreshTokenPurgeWorker({ refreshToken: { deleteMany } } as never);
    jest.spyOn(worker["logger"], "error").mockImplementation(() => undefined);

    await expect(worker.tick()).resolves.toBe(0);
  });
});
