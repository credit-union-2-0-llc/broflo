import { PrismaClient, PlanLimitType } from '@prisma/client';

const prisma = new PrismaClient();

type LimitSeed =
  | { type: 'BOOLEAN'; boolValue: boolean; description: string }
  | { type: 'INTEGER'; intValue?: number; isUnlimited?: boolean; description: string }
  | { type: 'CENTS'; intValue: number; description: string }
  | { type: 'STRING'; stringValue: string; description: string };

interface PlanSeed {
  key: string;
  name: string;
  priceMonthlyCents: number;
  priceAnnualCents: number;
  sortOrder: number;
  limits: Record<string, LimitSeed>;
}

// Mirrors today's real, deployed behavior exactly (TIER_MAX_PEOPLE, TIER_LIMITS,
// TIER_MAX_REQUESTS, TIER_COUNTS, TIER_PRICES_CENTS, and the various inline
// tier === "pro" | "elite" checks scattered across persons/photos/suggestions/
// gifts/enrichment/agent-orders/service-credit/autopilot). Changing a value
// here changes production behavior — this is the source of truth going
// forward, not a copy of it.
const PLAN_SEED: PlanSeed[] = [
  {
    key: 'free',
    name: 'Free',
    priceMonthlyCents: 0,
    priceAnnualCents: 0,
    sortOrder: 0,
    limits: {
      maxPeople: { type: 'INTEGER', intValue: 3, description: 'Max people a user can track' },
      photoLimitPerPerson: { type: 'INTEGER', intValue: 1, description: 'Max photos per person' },
      photoAiAnalysis: { type: 'BOOLEAN', boolValue: false, description: 'Queue uploaded photos for AI analysis' },
      photoReanalysis: { type: 'BOOLEAN', boolValue: false, description: 'Allow manual photo re-analysis' },
      maxRerollRequests: { type: 'INTEGER', intValue: 1, description: 'Max suggestion re-roll requests per event' },
      suggestionsPerRequest: { type: 'INTEGER', intValue: 3, description: 'Suggestions returned per request' },
      forceSafeSurprise: { type: 'BOOLEAN', boolValue: true, description: 'Force "safe" surprise factor, ignore user choice' },
      giftHistoryContext: { type: 'BOOLEAN', boolValue: false, description: 'Include gift history as AI suggestion context' },
      giftHistoryYearFilter: { type: 'BOOLEAN', boolValue: false, description: 'Allow filtering gift history by year + spend/rating aggregates' },
      eliteDossierInsights: { type: 'BOOLEAN', boolValue: false, description: 'AI-generated person dossier insights' },
      agentPurchasing: { type: 'BOOLEAN', boolValue: false, description: 'Browser-agent autonomous purchasing' },
      serviceCreditCents: { type: 'CENTS', intValue: 0, description: 'Service credit issued on a failed agent order' },
      autopilotEnabled: { type: 'BOOLEAN', boolValue: false, description: 'Autopilot scheduler eligibility' },
      autoExecute: { type: 'BOOLEAN', boolValue: false, description: 'Autopilot may auto-execute without manual approval' },
      gamification: { type: 'BOOLEAN', boolValue: false, description: 'Broflo Score / levels / gamification UI' },
      concierge: { type: 'BOOLEAN', boolValue: false, description: 'Concierge support access' },
      handwrittenNotes: { type: 'BOOLEAN', boolValue: false, description: 'Handwritten note add-on for orders' },
      aiModel: { type: 'STRING', stringValue: 'haiku', description: 'AI model used for suggestion generation' },
    },
  },
  {
    key: 'pro',
    name: 'Pro',
    priceMonthlyCents: 999,
    priceAnnualCents: 9900,
    sortOrder: 1,
    limits: {
      maxPeople: { type: 'INTEGER', isUnlimited: true, description: 'Max people a user can track' },
      photoLimitPerPerson: { type: 'INTEGER', intValue: 5, description: 'Max photos per person' },
      photoAiAnalysis: { type: 'BOOLEAN', boolValue: true, description: 'Queue uploaded photos for AI analysis' },
      photoReanalysis: { type: 'BOOLEAN', boolValue: false, description: 'Allow manual photo re-analysis' },
      maxRerollRequests: { type: 'INTEGER', intValue: 3, description: 'Max suggestion re-roll requests per event' },
      suggestionsPerRequest: { type: 'INTEGER', intValue: 5, description: 'Suggestions returned per request' },
      forceSafeSurprise: { type: 'BOOLEAN', boolValue: false, description: 'Force "safe" surprise factor, ignore user choice' },
      giftHistoryContext: { type: 'BOOLEAN', boolValue: true, description: 'Include gift history as AI suggestion context' },
      giftHistoryYearFilter: { type: 'BOOLEAN', boolValue: true, description: 'Allow filtering gift history by year + spend/rating aggregates' },
      eliteDossierInsights: { type: 'BOOLEAN', boolValue: false, description: 'AI-generated person dossier insights' },
      agentPurchasing: { type: 'BOOLEAN', boolValue: true, description: 'Browser-agent autonomous purchasing' },
      serviceCreditCents: { type: 'CENTS', intValue: 999, description: 'Service credit issued on a failed agent order' },
      autopilotEnabled: { type: 'BOOLEAN', boolValue: true, description: 'Autopilot scheduler eligibility' },
      autoExecute: { type: 'BOOLEAN', boolValue: true, description: 'Autopilot may auto-execute without manual approval' },
      gamification: { type: 'BOOLEAN', boolValue: true, description: 'Broflo Score / levels / gamification UI' },
      concierge: { type: 'BOOLEAN', boolValue: false, description: 'Concierge support access' },
      handwrittenNotes: { type: 'BOOLEAN', boolValue: false, description: 'Handwritten note add-on for orders' },
      aiModel: { type: 'STRING', stringValue: 'sonnet', description: 'AI model used for suggestion generation' },
    },
  },
  {
    key: 'elite',
    name: 'Elite',
    priceMonthlyCents: 2499,
    priceAnnualCents: 24900,
    sortOrder: 2,
    limits: {
      maxPeople: { type: 'INTEGER', isUnlimited: true, description: 'Max people a user can track' },
      photoLimitPerPerson: { type: 'INTEGER', isUnlimited: true, description: 'Max photos per person' },
      photoAiAnalysis: { type: 'BOOLEAN', boolValue: true, description: 'Queue uploaded photos for AI analysis' },
      photoReanalysis: { type: 'BOOLEAN', boolValue: true, description: 'Allow manual photo re-analysis' },
      maxRerollRequests: { type: 'INTEGER', isUnlimited: true, description: 'Max suggestion re-roll requests per event' },
      suggestionsPerRequest: { type: 'INTEGER', intValue: 5, description: 'Suggestions returned per request' },
      forceSafeSurprise: { type: 'BOOLEAN', boolValue: false, description: 'Force "safe" surprise factor, ignore user choice' },
      giftHistoryContext: { type: 'BOOLEAN', boolValue: true, description: 'Include gift history as AI suggestion context' },
      giftHistoryYearFilter: { type: 'BOOLEAN', boolValue: true, description: 'Allow filtering gift history by year + spend/rating aggregates' },
      eliteDossierInsights: { type: 'BOOLEAN', boolValue: true, description: 'AI-generated person dossier insights' },
      agentPurchasing: { type: 'BOOLEAN', boolValue: true, description: 'Browser-agent autonomous purchasing' },
      serviceCreditCents: { type: 'CENTS', intValue: 2499, description: 'Service credit issued on a failed agent order' },
      autopilotEnabled: { type: 'BOOLEAN', boolValue: true, description: 'Autopilot scheduler eligibility' },
      autoExecute: { type: 'BOOLEAN', boolValue: true, description: 'Autopilot may auto-execute without manual approval' },
      gamification: { type: 'BOOLEAN', boolValue: true, description: 'Broflo Score / levels / gamification UI' },
      concierge: { type: 'BOOLEAN', boolValue: true, description: 'Concierge support access' },
      handwrittenNotes: { type: 'BOOLEAN', boolValue: true, description: 'Handwritten note add-on for orders' },
      aiModel: { type: 'STRING', stringValue: 'sonnet', description: 'AI model used for suggestion generation' },
    },
  },
];

async function seedPlans() {
  for (const planSeed of PLAN_SEED) {
    const plan = await prisma.plan.upsert({
      where: { key: planSeed.key },
      update: {
        name: planSeed.name,
        priceMonthlyCents: planSeed.priceMonthlyCents,
        priceAnnualCents: planSeed.priceAnnualCents,
        sortOrder: planSeed.sortOrder,
        stripePriceIdMonthly: process.env[`STRIPE_${planSeed.key.toUpperCase()}_MONTHLY_PRICE_ID`] || undefined,
        stripePriceIdAnnual: process.env[`STRIPE_${planSeed.key.toUpperCase()}_ANNUAL_PRICE_ID`] || undefined,
      },
      create: {
        key: planSeed.key,
        name: planSeed.name,
        priceMonthlyCents: planSeed.priceMonthlyCents,
        priceAnnualCents: planSeed.priceAnnualCents,
        sortOrder: planSeed.sortOrder,
        stripePriceIdMonthly: process.env[`STRIPE_${planSeed.key.toUpperCase()}_MONTHLY_PRICE_ID`],
        stripePriceIdAnnual: process.env[`STRIPE_${planSeed.key.toUpperCase()}_ANNUAL_PRICE_ID`],
      },
    });

    for (const [featureKey, limit] of Object.entries(planSeed.limits)) {
      await prisma.planLimit.upsert({
        where: { uq_plan_limit_plan_feature: { planId: plan.id, featureKey } },
        update: {
          type: limit.type as PlanLimitType,
          boolValue: limit.type === 'BOOLEAN' ? limit.boolValue : null,
          intValue: limit.type === 'INTEGER' || limit.type === 'CENTS' ? limit.intValue ?? null : null,
          isUnlimited: limit.type === 'INTEGER' ? !!limit.isUnlimited : false,
          stringValue: limit.type === 'STRING' ? limit.stringValue : null,
          description: limit.description,
        },
        create: {
          planId: plan.id,
          featureKey,
          type: limit.type as PlanLimitType,
          boolValue: limit.type === 'BOOLEAN' ? limit.boolValue : null,
          intValue: limit.type === 'INTEGER' || limit.type === 'CENTS' ? limit.intValue ?? null : null,
          isUnlimited: limit.type === 'INTEGER' ? !!limit.isUnlimited : false,
          stringValue: limit.type === 'STRING' ? limit.stringValue : null,
          description: limit.description,
        },
      });
    }

    console.log(`Seeded plan: ${planSeed.name} (${Object.keys(planSeed.limits).length} limits)`);
  }
}

async function seedAdminsFromEnv() {
  const raw = process.env.ADMIN_EMAILS || '';
  const emails = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) {
    console.log('ADMIN_EMAILS not set — skipping admin backfill');
    return;
  }
  const result = await prisma.user.updateMany({
    where: { email: { in: emails } },
    data: { isAdmin: true },
  });
  console.log(`Marked ${result.count} user(s) as admin from ADMIN_EMAILS`);
}

async function main() {
  await seedPlans();
  await seedAdminsFromEnv();

  // Seed RetailerProfiles for S-10 Browser Agent
  const retailers = [
    {
      retailerDomain: 'nordstrom.com',
      displayName: 'Nordstrom',
      supported: true,
      searchUrlPattern: 'https://www.nordstrom.com/sr?keyword={query}',
      notes: 'Department store. Good product search. Occasional CAPTCHA on checkout.',
    },
    {
      retailerDomain: 'williams-sonoma.com',
      displayName: 'Williams Sonoma',
      supported: true,
      searchUrlPattern: 'https://www.williams-sonoma.com/search/results.html?words={query}',
      notes: 'Kitchen/home goods. Clean checkout flow. Rare CAPTCHA.',
    },
    {
      retailerDomain: 'uncommongoods.com',
      displayName: 'Uncommon Goods',
      supported: true,
      searchUrlPattern: 'https://www.uncommongoods.com/search?q={query}',
      notes: 'Unique gifts. Simple site structure. Good for agent navigation.',
    },
  ];

  for (const r of retailers) {
    await prisma.retailerProfile.upsert({
      where: { retailerDomain: r.retailerDomain },
      update: {
        displayName: r.displayName,
        supported: r.supported,
        searchUrlPattern: r.searchUrlPattern,
        notes: r.notes,
      },
      create: r,
    });
    console.log(`Seeded retailer: ${r.displayName}`);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
