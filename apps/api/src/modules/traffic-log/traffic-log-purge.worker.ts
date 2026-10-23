import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { TrafficLogService } from "./traffic-log.service";

export const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Deletes traffic log records once they pass the legal retention period
 * (TrafficLogService.purgeExpired): shortly after start, then every 6 hours.
 * Deleting is idempotent, so several API processes running it is harmless.
 *
 * Set TRAFFIC_LOG_PURGE_DISABLED=1 to keep a process from running it.
 */
@Injectable()
export class TrafficLogPurgeWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrafficLogPurgeWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;

  constructor(private readonly trafficLog: TrafficLogService) {}

  onModuleInit(): void {
    if (process.env.TRAFFIC_LOG_PURGE_DISABLED === "1") return;
    // A minute after start, so it never competes with the boot itself.
    this.first = setTimeout(() => void this.tick(), 60_000);
    this.timer = setInterval(() => void this.tick(), PURGE_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    try {
      await this.trafficLog.purgeExpired();
    } catch (err) {
      this.logger.error("Deleting expired traffic log records failed", err as Error);
    }
  }
}
