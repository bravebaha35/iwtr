import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TokenService } from "./token.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";

@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtAuthGuard, OptionalJwtAuthGuard],
  exports: [TokenService, JwtAuthGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}
