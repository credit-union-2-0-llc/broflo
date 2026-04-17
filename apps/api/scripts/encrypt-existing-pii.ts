/**
 * One-time migration: encrypt existing Person PII fields.
 *
 * Usage: PII_ENCRYPTION_KEY=<hex> DATABASE_URL=<url> npx tsx scripts/encrypt-existing-pii.ts
 *
 * Safe to run multiple times — skips already-encrypted values (enc: prefix).
 */
import { PrismaClient } from "@prisma/client";
import { encrypt, isEncrypted } from "../src/crypto/crypto";

const PII_STRING_FIELDS = [
  "name",
  "shippingAddress1",
  "shippingAddress2",
  "shippingCity",
  "shippingState",
  "shippingZip",
] as const;

const PII_ARRAY_FIELDS = ["allergens", "dietaryRestrictions"] as const;

async function main() {
  if (!process.env.PII_ENCRYPTION_KEY) {
    console.error("PII_ENCRYPTION_KEY is required");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const persons = await prisma.person.findMany();
  console.log(`Found ${persons.length} persons to process`);

  let updated = 0;
  for (const person of persons) {
    const data: Record<string, unknown> = {};
    let needsUpdate = false;

    for (const field of PII_STRING_FIELDS) {
      const val = person[field];
      if (typeof val === "string" && val.length > 0 && !isEncrypted(val)) {
        data[field] = encrypt(val);
        needsUpdate = true;
      }
    }

    for (const field of PII_ARRAY_FIELDS) {
      const arr = person[field];
      if (Array.isArray(arr) && arr.some((v) => typeof v === "string" && !isEncrypted(v))) {
        data[field] = arr.map((v) =>
          typeof v === "string" && !isEncrypted(v) ? encrypt(v) : v,
        );
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await prisma.person.update({
        where: { id: person.id },
        data,
      });
      updated++;
    }
  }

  console.log(`Encrypted PII for ${updated}/${persons.length} persons`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
