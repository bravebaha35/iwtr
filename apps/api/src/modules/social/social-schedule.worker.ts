import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { SocialScheduleService } from "./social-schedule.service";

// A scheduled post goes out within this long of its time.
export const SCHEDULE_POLL_INTERVAL_MS = 30_000;

/**
 * Publishes scheduled IWT Social posts when their time comes. The queue is
 * the ScheduledSocialPost table, and a post is claimed by deleting its row
 * inside the publishing transaction, so two processes never publish the same
 * one and a restart loses nothing.
 *
 * Set SOCIAL_SCHEDULE_WORKER_DISABLED=1 to keep a process from polling.
 */
@Injectable()
export class SocialScheduleWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SocialScheduleWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(private readonly schedule: SocialScheduleService) {}

  onModuleInit(): void {
    if (process.env.SOCIAL_SCHEDULE_WORKER_DISABLED === "1") return;
    this.timer = setInterval(() => void this.tick(), SCHEDULE_POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.schedule.publishDue();
    } catch (err) {
      this.logger.error("Publishing scheduled posts failed", err as Error);
    } finally {
      this.busy = false;
    }
  }
}
