import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { logAndReport } from "../../common/monitoring/log-and-report";
import { SocialScheduleService } from "./social-schedule.service";
import { SocialInsightsService } from "./social-insights.service";

// A scheduled post goes out within this long of its time.
export const SCHEDULE_POLL_INTERVAL_MS = 30_000;
// Old Insights day rows are cleared this often (see pruneOldDays).
export const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Publishes scheduled IWT Social posts when their time comes. The queue is
 * the ScheduledSocialPost table, and a post is claimed by deleting its row
 * inside the publishing transaction, so two processes never publish the same
 * one and a restart loses nothing.
 *
 * The same pass clears the Insights day counters older than any plan can
 * look back, every few hours.
 *
 * Set SOCIAL_SCHEDULE_WORKER_DISABLED=1 to keep a process from polling.
 */
@Injectable()
export class SocialScheduleWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SocialScheduleWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private lastPrune = 0;

  constructor(
    private readonly schedule: SocialScheduleService,
    private readonly insights: SocialInsightsService,
  ) {}

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
      logAndReport(this.logger, "Publishing scheduled posts failed", err);
    }
    try {
      if (Date.now() - this.lastPrune >= PRUNE_INTERVAL_MS) {
        this.lastPrune = Date.now();
        await this.insights.pruneOldDays();
      }
    } catch (err) {
      logAndReport(this.logger, "Clearing old Insights days failed", err);
    } finally {
      this.busy = false;
    }
  }
}
