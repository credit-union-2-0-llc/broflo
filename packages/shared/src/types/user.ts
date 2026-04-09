export type SubscriptionTier = "free" | "pro" | "elite";

export interface BrofloUser {
  id: string;
  email: string;
  name: string | null;
  subscriptionTier: SubscriptionTier;
  stripeCustomerId: string | null;
  brofloScore: number;
  createdAt: Date;
}
