import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { TrafficLogService } from "./traffic-log.service";
import { TrafficLogInterceptor } from "./traffic-log.interceptor";

@Module({
  providers: [TrafficLogService, { provide: APP_INTERCEPTOR, useClass: TrafficLogInterceptor }],
  exports: [TrafficLogService],
})
export class TrafficLogModule {}
