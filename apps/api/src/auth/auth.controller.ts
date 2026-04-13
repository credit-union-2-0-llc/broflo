import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import type { User } from "@prisma/client";
import { AuthService } from "./auth.service";
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import {
  SignupDto,
  LoginDto,
  RefreshDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  OAuthExchangeDto,
} from "./dto/auth.dto";

@Throttle({ short: { ttl: 60000, limit: parseInt(process.env.THROTTLE_AUTH_LIMIT || "5", 10) } })
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("signup")
  async signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
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
    // Extract JTI and exp from the current token
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64").toString(),
      );
      await this.auth.logout(user.id, payload.jti, payload.exp);
    }
    return { message: "Logged out" };
  }

  @Public()
  @Post("forgot")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto);
    return { message: "If that email exists, a reset link has been sent." };
  }

  @Public()
  @Post("reset")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Get("me")
  async me(@CurrentUser() user: User) {
    return this.auth.sanitizeUser(user);
  }

  // --- Google OAuth ---

  @Public()
  @Get("google")
  @UseGuards(AuthGuard("google"))
  googleLogin() {
    // Passport redirects to Google
  }

  @Public()
  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User;
    const code = await this.auth.createOAuthCode(user);

    const webUrl = process.env.WEB_URL || "http://localhost:3000";
    res.redirect(`${webUrl}/auth/callback?code=${code}`);
  }

  @Public()
  @Post("oauth-exchange")
  @HttpCode(HttpStatus.OK)
  async oauthExchange(@Body() dto: OAuthExchangeDto) {
    return this.auth.exchangeOAuthCode(dto.code);
  }
}
