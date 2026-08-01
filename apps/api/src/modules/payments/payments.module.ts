import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { IyzicoProvider } from "./iyzico.provider";

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, IyzicoProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
