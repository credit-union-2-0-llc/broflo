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
import {
  SendOtpDto,
  VerifyOtpDto,
  RefreshDto,
  SignupDto,
  LoginDto,
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SetPasswordDto,
} from "./dto/auth.dto";
import { isE2EHatchRequest } from "./util/e2e-hatch";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ── Email + password (primary) ──────────────────────────────

  // Sends a verification email, so keep the per-IP cap tight (same as send-otp).
  @Public()
  @Throttle({ short: { ttl: 60000, limit: parseInt(process.env.THROTTLE_SIGNUP_LIMIT || "5", 10) } })
  @Post("signup")
  @HttpCode(HttpStatus.OK)
  async signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto.email, dto.password);
  }

  // No email/side-effect on failure, but it's the brute-force target — the
  // per-email lockout lives in AuthService; this is the per-IP backstop.
  @Public()
  @Throttle({ short: { ttl: 60000, limit: parseInt(process.env.THROTTLE_LOGIN_LIMIT || "15", 10) } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Throttle({ short: { ttl: 60000, limit: parseInt(process.env.THROTTLE_VERIFY_EMAIL_LIMIT || "15", 10) } })
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Public()
  @Throttle({ short: { ttl: 60000, limit: parseInt(process.env.THROTTLE_RESEND_VERIFY_LIMIT || "3", 10) } })
  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto.email);
  }

  @Public()
  @Throttle({ short: { ttl: 60000, limit: parseInt(process.env.THROTTLE_FORGOT_PW_LIMIT || "3", 10) } })
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ short: { ttl: 60000, limit: parseInt(process.env.THROTTLE_RESET_PW_LIMIT || "10", 10) } })
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  // Authenticated — the "set a password" step forced on OTP-created accounts
  // that have none, and change-password for anyone logged in.
  @Post("set-password")
  @HttpCode(HttpStatus.OK)
  async setPassword(@CurrentUser() user: User, @Body() dto: SetPasswordDto) {
    return this.auth.setPassword(user.id, dto.password);
  }

  // Tight limit — sending an OTP triggers a real email. (The Redis-backed
  // checkOtpRateLimit inside AuthService is a second, independent cap of
  // 3 requests/15min per email; this is a per-IP backstop on top of that.)
  @Public()
  @Throttle({ short: { ttl: 60000, limit: parseInt(process.env.THROTTLE_SEND_OTP_LIMIT || "5", 10) } })
  @Post("send-otp")
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() dto: SendOtpDto, @Req() req: Request) {
    return this.auth.sendOtp(dto, isE2EHatchRequest(req, dto.email));
  }

  // Deliberately more generous than send-otp — this only checks a code
  // (no email sent, no side effect on failure), and typos are common.
  // Sharing one tight bucket across every /auth route used to mean a
  // couple of mistyped codes would 429 even the *correct* one for the
  // rest of the window, indistinguishable from "wrong code" on the client.
  @Public()
  @Throttle({ short: { ttl: 60000, limit: parseInt(process.env.THROTTLE_VERIFY_OTP_LIMIT || "15", 10) } })
  @Post("verify-otp")
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  // Refresh has no side effects on failure (no email, no account lockout)
  // and a single page load can legitimately trigger several near-simultaneous
  // refresh attempts (parallel data-fetching requests that all notice the
  // same expired token). The shared global default (10/min per IP) was
  // getting exhausted by ordinary usage, cascading into every subsequent
  // request failing 401 for the rest of the window — indistinguishable from
  // "you have no data" on screens that swallow fetch errors.
  @Public()
  @Throttle({ short: { ttl: 60000, limit: parseInt(process.env.THROTTLE_REFRESH_LIMIT || "30", 10) } })
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
