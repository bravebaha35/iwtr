import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TokenService } from "./token.service";
import { AdminLoginOtpService } from "./admin-login-otp.service";
import { ADMIN_OTP_NOTIFIER } from "./admin-otp-notifier.interface";
import { ConsoleAdminOtpNotifier } from "./console-admin-otp-notifier";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    AdminLoginOtpService,
    { provide: ADMIN_OTP_NOTIFIER, useClass: ConsoleAdminOtpNotifier },
    JwtAuthGuard,
    OptionalJwtAuthGuard,
  ],
  exports: [TokenService, JwtAuthGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}
