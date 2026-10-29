import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { logAndReport } from "../../common/monitoring/log-and-report";

export const REFRESH_TOKEN_PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;
// Kept a day past expiry so a token that ran out moments ago still gets the
// normal "expired" answer rather than "unknown".
export const REFRESH_TOKEN_PURGE_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes refresh tokens that have passed their expiry. Only expired rows go:
 * a revoked token that has not yet expired is kept on purpose, because a
 * replay of it is how AuthService.refresh spots a stolen token (and signs that
 * user out everywhere). Once expired it would be refused anyway, so the row
 * has no use left. Runs a minute after start, then every 6 hours; deleting is
 * idempotent, so several API processes running it is harmless.
 *
 * Set REFRESH_TOKEN_PURGE_DISABLED=1 to keep a process from running it.
 */
@Injectable()
export class RefreshTokenPurgeWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RefreshTokenPurgeWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (process.env.REFRESH_TOKEN_PURGE_DISABLED === "1") return;
    this.first = setTimeout(() => void this.tick(), 60_000);
    this.timer = setInterval(() => void this.tick(), REFRESH_TOKEN_PURGE_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now: Date = new Date()): Promise<number> {
    try {
      const { count } = await this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date(now.getTime() - REFRESH_TOKEN_PURGE_GRACE_MS) } },
      });
      if (count > 0) this.logger.log(`Deleted ${count} expired refresh tokens`);
      return count;
    } catch (err) {
      logAndReport(this.logger, "Deleting expired refresh tokens failed", err);
      return 0;
    }
  }
}
