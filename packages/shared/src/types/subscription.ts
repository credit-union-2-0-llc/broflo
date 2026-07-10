import type { SubscriptionTier } from "./user";

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  limits: {
    maxPeople: number | null; // null = unlimited
    autoExecute: boolean;
    autopilot: boolean;
    gamification: boolean;
    concierge: boolean;
    handwrittenNotes: boolean;
  };
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    tier: "free",
    name: "Free",
    priceMonthly: 0,
    priceAnnual: 0,
    limits: {
      maxPeople: 3,
      autoExecute: false,
      autopilot: false,
      gamification: false,
      concierge: false,
      handwrittenNotes: false,
    },
  },
  pro: {
    tier: "pro",
    name: "Pro",
    priceMonthly: 9.99,
    priceAnnual: 108,
    limits: {
      maxPeople: null,
      autoExecute: true,
      autopilot: true,
      gamification: true,
      concierge: false,
      handwrittenNotes: false,
    },
  },
  elite: {
    tier: "elite",
    name: "Elite",
    priceMonthly: 24.99,
    priceAnnual: 270,
    limits: {
      maxPeople: null,
      autoExecute: true,
      autopilot: true,
      gamification: true,
      concierge: true,
      handwrittenNotes: true,
    },
  },
  family: {
    tier: "family",
    name: "Family",
    priceMonthly: 39.99,
    priceAnnual: 432,
    limits: {
      maxPeople: null,
      autoExecute: true,
      autopilot: true,
      gamification: true,
      concierge: true,
      handwrittenNotes: true,
    },
  },
};

// Rank order for "at least X" tier checks — matches
// apps/api/src/billing/guards/subscription.guard.ts's TIER_RANK exactly.
// Use tierAtLeast() instead of hardcoding `tier === "pro" || tier === "elite"`
// style checks, which silently exclude any tier added later (e.g. family
// was missed in several places until this was introduced).
export const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  elite: 2,
  family: 3,
};

export function tierAtLeast(tier: string, minimum: SubscriptionTier): boolean {
  return (TIER_RANK[tier as SubscriptionTier] ?? 0) >= TIER_RANK[minimum];
}
