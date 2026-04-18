import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import type { User } from "@prisma/client";
import { AuthService } from "./auth.service";
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { SendOtpDto, VerifyOtpDto, RefreshDto } from "./dto/auth.dto";
import { isE2EHatchRequest } from "./util/e2e-hatch";

@Throttle({ short: { ttl: 60000, limit: parseInt(process.env.THROTTLE_AUTH_LIMIT || "5", 10) } })
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("send-otp")
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() dto: SendOtpDto, @Req() req: Request) {
    return this.auth.sendOtp(dto, isE2EHatchRequest(req, dto.email));
  }

  @Public()
  @Post("verify-otp")
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request) {
    const user = req.user as User;
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64").toString(),
      );
      await this.auth.logout(user.id, payload.jti, payload.exp);
    }
    return { message: "Logged out" };
  }

  @Get("me")
  async me(@CurrentUser() user: User) {
    return this.auth.sanitizeUser(user);
  }
}
