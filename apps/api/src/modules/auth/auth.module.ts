import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TokenService } from "./token.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtAuthGuard],
  exports: [TokenService, JwtAuthGuard],
})
export class AuthModule {}
