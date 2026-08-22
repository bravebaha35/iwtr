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
}
