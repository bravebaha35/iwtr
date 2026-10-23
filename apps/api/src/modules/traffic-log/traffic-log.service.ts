import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { encryptIp, hashIp } from "./crypto.util";

export interface TrafficLogEntry {
  ip: string;
  endpoint: string;
  method: string;
  statusCode?: number;
  userId?: string;
}

// Law 5651 keeps traffic records "no less than one year and no more than two".
// TRAFFIC_LOG_RETENTION_DAYS picks the figure inside that range (the lawyer
// confirms which); unset, records are kept the full two years.
export const MIN_RETENTION_DAYS = 365;
export const MAX_RETENTION_DAYS = 730;

export function trafficLogRetentionDays(raw = process.env.TRAFFIC_LOG_RETENTION_DAYS): number {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n)) return MAX_RETENTION_DAYS;
  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, n));
}

@Injectable()
export class TrafficLogService {
  private readonly logger = new Logger(TrafficLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Never throws — a compliance-log write must never take down the real
  // request (login/register/review-submit) it's recording. Errors are
  // logged so they're visible to whoever's watching the API console, not
  // swallowed entirely.
  async record(entry: TrafficLogEntry): Promise<void> {
    try {
      await this.prisma.trafficLog.create({
        data: {
          encIp: encryptIp(entry.ip),
          ipHash: hashIp(entry.ip),
          endpoint: entry.endpoint,
          method: entry.method,
          statusCode: entry.statusCode,
          userId: entry.userId,
        },
      });
    } catch (err) {
      this.logger.error("Failed to write traffic log entry", err instanceof Error ? err.stack : err);
    }
  }

  /** Deletes records older than the retention period; returns how many. */
  async purgeExpired(now = new Date(), retentionDays = trafficLogRetentionDays()): Promise<number> {
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.trafficLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (count > 0) this.logger.log(`Deleted ${count} traffic log records older than ${retentionDays} days`);
    return count;
  }
}
