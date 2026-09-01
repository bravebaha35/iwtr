import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  devAdminLoginInputSchema,
  loginEmailInputSchema,
  oauthLoginInputSchema,
  refreshRequestSchema,
  registerEmailInputSchema,
  verifyAdminOtpInputSchema,
  type DevAdminLoginInput,
  type LoginEmailInput,
  type OAuthLoginInput,
  type RefreshRequest,
  type RegisterEmailInput,
  type VerifyAdminOtpInput,
} from "@iwtr/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Tighter than the global default (100/min) — these are the two endpoints
  // a credential-stuffing or fake-account-farming script would actually hit,
  // so they get their own low ceiling rather than relying on the blanket limit.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("register")
  register(@Body(new ZodValidationPipe(registerEmailInputSchema)) body: RegisterEmailInput) {
    return this.auth.registerWithEmail(body, "web");
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  login(@Body(new ZodValidationPipe(loginEmailInputSchema)) body: LoginEmailInput) {
    return this.auth.loginWithEmail(body, "web");
  }

  // Tighter still than login/register — this is the one endpoint that lets
  // someone repeatedly guess a 6-digit code, so it gets the lowest ceiling
  // of any auth route (AdminLoginOtpService's own 5-attempts-per-challenge
  // limit is the real backstop; this just slows down someone burning through
  // challenges to reset that counter).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login/verify-otp")
  verifyLoginOtp(@Body(new ZodValidationPipe(verifyAdminOtpInputSchema)) body: VerifyAdminOtpInput) {
    return this.auth.verifyAdminLoginOtp(body, "web");
  }

  // Local-dev-only shortcut — see AuthService.devAdminLogin for the
  // production refusal that makes this safe to leave wired up.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("dev-admin-login")
  devAdminLogin(@Body(new ZodValidationPipe(devAdminLoginInputSchema)) body: DevAdminLoginInput) {
    return this.auth.devAdminLogin(body.email);
  }

  @Post("refresh")
  refresh(@Body(new ZodValidationPipe(refreshRequestSchema)) body: RefreshRequest) {
    if (!body.refreshToken) {
      throw new BadRequestException("refreshToken is required");
    }
    return this.auth.refresh(body.refreshToken);
  }

  @Post("logout")
  async logout(@Body(new ZodValidationPipe(refreshRequestSchema)) body: RefreshRequest) {
    if (body.refreshToken) {
      await this.auth.logout(body.refreshToken);
    }
    return { success: true };
  }

  @Post("google")
  google(@Body(new ZodValidationPipe(oauthLoginInputSchema)) body: OAuthLoginInput) {
    return this.auth.loginWithGoogle(body.idToken);
  }

  @Post("apple")
  apple(@Body(new ZodValidationPipe(oauthLoginInputSchema)) body: OAuthLoginInput) {
    return this.auth.loginWithApple(body.idToken);
  }
}
