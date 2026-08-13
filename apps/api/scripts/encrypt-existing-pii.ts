/**
 * One-time migration: encrypt existing PII at rest that predates working
 * encryption.
 *
 * This exists because the PII write-encryption used to silently no-op inside
 * Prisma interactive transactions (the tx client's delegates weren't the
 * patched ones) — and the primary "add a person" path and agent-order preview
 * both write through a transaction, so most existing Person/AgentJob rows hold
 * PLAINTEXT PII. The middleware fix encrypts everything going forward; this
 * backfills what's already there.
 *
 * Field lists and models are imported from the middleware so this can never
 * drift out of sync with what actually gets encrypted on write (the previous
 * version of this script had — it was missing notes/foodPreferences/
 * wishlistUrls and the Order/AgentJob models entirely).
 *
 * Usage:
 *   Dry run (default — reports counts, writes nothing):
 *     PII_ENCRYPTION_KEY=<hex> DATABASE_URL=<url> pnpm exec ts-node scripts/encrypt-existing-pii.ts
 *   Apply:
 *     PII_ENCRYPTION_KEY=<hex> DATABASE_URL=<url> pnpm exec ts-node scripts/encrypt-existing-pii.ts --apply
 *
 * In production, run via the "Backfill PII encryption (one-time)" GitHub
 * Actions workflow rather than by hand — it has prod DATABASE_URL + fetches
 * PII_ENCRYPTION_KEY from broflo-api's App Service settings.
 *
 * Safe to run multiple times — only ever encrypts values that aren't already
 * "enc:"-prefixed, so re-running is a no-op on already-migrated rows. Uses a
 * RAW PrismaClient (no piiExtension) and encrypts fields explicitly, so there
 * is no double-encryption.
 */
import { PrismaClient } from "@prisma/client";
import { encrypt, isEncrypted } from "../src/crypto/crypto";
import {
  PII_STRING_FIELDS,
  PII_ARRAY_FIELDS,
  PII_WRITE_MODELS,
} from "../src/crypto/pii.middleware";

type Row = Record<string, unknown> & { id: string };

// Build the encrypted patch for one row, or null if nothing needs changing.
function buildPatch(row: Row): Record<string, unknown> | null {
  const data: Record<string, unknown> = {};
  let needsUpdate = false;

  for (const field of PII_STRING_FIELDS) {
    const val = row[field];
    if (typeof val === "string" && val.length > 0 && !isEncrypted(val)) {
      data[field] = encrypt(val);
      needsUpdate = true;
    }
  }

  for (const field of PII_ARRAY_FIELDS) {
    const arr = row[field];
    if (Array.isArray(arr) && arr.some((v) => typeof v === "string" && !isEncrypted(v))) {
      data[field] = arr.map((v) =>
        typeof v === "string" && !isEncrypted(v) ? encrypt(v) : v,
      );
      needsUpdate = true;
    }
  }

  return needsUpdate ? data : null;
}

async function main() {
  if (!process.env.PII_ENCRYPTION_KEY) {
    console.error("PII_ENCRYPTION_KEY is required");
    process.exit(1);
  }

  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  const client = prisma as unknown as Record<
    string,
    { findMany: () => Promise<Row[]>; update: (a: unknown) => Promise<unknown> }
  >;

  console.log(apply ? "APPLY mode — writing changes" : "DRY RUN — no writes (pass --apply to write)");

  let grandTotal = 0;
  let grandUpdated = 0;

  for (const model of PII_WRITE_MODELS) {
    const delegate = client[model];
    if (!delegate) continue;
    const rows = await delegate.findMany();
    let updated = 0;

    for (const row of rows) {
      const patch = buildPatch(row);
      if (!patch) continue;
      updated++;
      if (apply) {
        await delegate.update({ where: { id: row.id }, data: patch });
      }
    }

    console.log(
      `  ${model}: ${updated}/${rows.length} row(s) ${apply ? "encrypted" : "would be encrypted"}`,
    );
    grandTotal += rows.length;
    grandUpdated += updated;
  }

  console.log(
    `${apply ? "Encrypted" : "Would encrypt"} PII on ${grandUpdated}/${grandTotal} row(s) across ${PII_WRITE_MODELS.length} models`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
