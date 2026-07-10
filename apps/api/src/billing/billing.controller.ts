import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Headers,
  RawBodyRequest,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { IsIn } from "class-validator";
import type { Request } from "express";
import type { User } from "@prisma/client";
import { BillingService } from "./billing.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { SkipThrottle } from "@nestjs/throttler";

class DevSetTierDto {
  @IsIn(["free", "pro", "elite", "family"])
  tier!: "free" | "pro" | "elite" | "family";
}

@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post("checkout-session")
  async createCheckoutSession(
    @CurrentUser() user: User,
    @Body() body: { priceId: string },
  ) {
    if (!body.priceId) {
      throw new BadRequestException("priceId is required");
    }
    return this.billing.createCheckoutSession(user, body.priceId);
  }

  @Post("portal-session")
  async createPortalSession(@CurrentUser() user: User) {
    return this.billing.createPortalSession(user);
  }

  @Get("subscription")
  async getSubscription(@CurrentUser() user: User) {
    return this.billing.getSubscription(user);
  }

  // Temporary, unauthenticated diagnostic for the "testing card isn't
  // showing" report — isolates whether the deployed process actually sees
  // ALLOW_DEV_TIER_OVERRIDE=true without needing a logged-in session to
  // check. Remove once that's root-caused.
  @Public()
  @Get("dev-override-status")
  async devOverrideStatus() {
    return { enabled: process.env.ALLOW_DEV_TIER_OVERRIDE === "true" };
  }

  @Post("dev-set-tier")
  async devSetTier(@CurrentUser() user: User, @Body() body: DevSetTierDto) {
    return this.billing.devSetTier(user, body.tier);
  }

  @Public()
  @SkipThrottle()
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException("Missing raw body");
    }
    await this.billing.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}
