import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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
