import { SetMetadata } from "@nestjs/common";

export type SubscriptionTier = "free" | "pro" | "elite";
export const REQUIRED_TIER_KEY = "requiredTier";
export const RequiresTier = (...tiers: SubscriptionTier[]) =>
  SetMetadata(REQUIRED_TIER_KEY, tiers);
