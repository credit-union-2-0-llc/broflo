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
    priceAnnual: 99,
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
    priceAnnual: 249,
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
