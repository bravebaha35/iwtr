import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import {
  loginEmailInputSchema,
  oauthLoginInputSchema,
  refreshRequestSchema,
  registerEmailInputSchema,
  type LoginEmailInput,
  type OAuthLoginInput,
  type RefreshRequest,
  type RegisterEmailInput,
} from "@iwtr/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body(new ZodValidationPipe(registerEmailInputSchema)) body: RegisterEmailInput) {
    return this.auth.registerWithEmail(body, "web");
  }

  @Post("login")
  login(@Body(new ZodValidationPipe(loginEmailInputSchema)) body: LoginEmailInput) {
    return this.auth.loginWithEmail(body, "web");
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
