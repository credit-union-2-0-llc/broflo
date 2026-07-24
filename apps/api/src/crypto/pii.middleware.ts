import { Prisma, PrismaClient } from "@prisma/client";
import { encrypt, decrypt, isEncrypted, hasKey } from "./crypto";

// Fields encrypted on write. These names are treated as PII on the
// PII-owning models below — never add a name that also exists as a
// non-PII column on those models (it would be stored as ciphertext and
// break equality filters).
const PII_STRING_FIELDS = [
  "name",
  "notes",
  "foodPreferences",
  "wishlistUrls",
  "shippingName",
  "shippingAddress1",
  "shippingAddress2",
  "shippingCity",
  "shippingState",
  "shippingZip",
] as const;

const PII_ARRAY_FIELDS = ["allergens", "dietaryRestrictions"] as const;

// Models whose writes carry the PII fields above and must be encrypted.
// Person (dossier), Order (recipient shipping), AgentJob (recipient shipping).
const PII_WRITE_MODELS = ["person", "order", "agentJob"] as const;

const WRITE_METHODS = ["create", "update", "upsert", "createMany"] as const;
const READ_METHODS = [
  "findFirst",
  "findUnique",
  "findMany",
  "findFirstOrThrow",
  "findUniqueOrThrow",
] as const;

const MAX_DEPTH = 8;

export function encryptData(data: Record<string, unknown>): void {
  for (const field of PII_STRING_FIELDS) {
    if (field in data && typeof data[field] === "string" && (data[field] as string).length > 0) {
      data[field] = encrypt(data[field] as string);
    }
  }
  for (const field of PII_ARRAY_FIELDS) {
    if (field in data && Array.isArray(data[field])) {
      data[field] = (data[field] as string[]).map((v) =>
        typeof v === "string" ? encrypt(v) : v,
      );
    }
  }
}

/**
 * Recursively decrypt every encrypted value in a query result, including
 * nested relations (e.g. order.person.name). Decryption is prefix-based:
 * `decrypt` returns non-"enc:" strings unchanged, so walking every field of
 * every model is safe — plaintext, legacy rows, dates, and numbers all pass
 * through untouched.
 */
export function decryptResult(result: unknown, depth = 0): void {
  if (result == null || depth > MAX_DEPTH) return;
  if (Array.isArray(result)) {
    for (const item of result) decryptResult(item, depth + 1);
    return;
  }
  if (typeof result !== "object") return;
  // Only descend into plain objects. Date / Prisma.Decimal / Buffer are
  // class instances (non-Object prototype) and hold no "enc:" strings.
  const proto = Object.getPrototypeOf(result);
  if (proto !== Object.prototype && proto !== null) return;

  const record = result as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (typeof value === "string") {
      if (isEncrypted(value)) record[key] = decrypt(value);
    } else if (value !== null && typeof value === "object") {
      decryptResult(value, depth + 1);
    }
  }
}

function resolvePromise(result: unknown, after: (r: unknown) => void): unknown {
  if (result && typeof (result as Record<string, unknown>).then === "function") {
    return (result as Promise<unknown>).then((r) => {
      after(r);
      return r;
    });
  }
  after(result);
  return result;
}

function patchWriteMethods(delegate: Record<string, unknown>): void {
  for (const method of WRITE_METHODS) {
    const original = delegate[method] as ((...a: unknown[]) => unknown) | undefined;
    if (!original) continue;
    delegate[method] = (...args: unknown[]) => {
      const opts = args[0] as Record<string, unknown> | undefined;
      if (opts?.data && typeof opts.data === "object") {
        encryptData(opts.data as Record<string, unknown>);
      }
      if (opts?.create && typeof opts.create === "object") {
        encryptData(opts.create as Record<string, unknown>);
      }
      if (opts?.update && typeof opts.update === "object") {
        encryptData(opts.update as Record<string, unknown>);
      }
      return resolvePromise(original.apply(delegate, args), decryptResult);
    };
  }
}

function patchReadMethods(delegate: Record<string, unknown>): void {
  for (const method of READ_METHODS) {
    const original = delegate[method] as ((...a: unknown[]) => unknown) | undefined;
    if (!original) continue;
    delegate[method] = (...args: unknown[]) =>
      resolvePromise(original.apply(delegate, args), decryptResult);
  }
}

/**
 * Register PII encryption on the Prisma client (in place; Prisma 6 removed
 * $use). Writes are encrypted only on the PII-owning models; reads are
 * decrypted on every model so PII surfaces correctly even when pulled through
 * a relation on a non-PII model.
 */
export function piiExtension(prisma: PrismaClient): void {
  if (!hasKey()) return;

  const client = prisma as unknown as Record<string, Record<string, unknown>>;

  for (const modelKey of PII_WRITE_MODELS) {
    const delegate = client[modelKey];
    if (delegate) patchWriteMethods(delegate);
  }

  for (const model of Prisma.dmmf.datamodel.models) {
    const modelKey = model.name.charAt(0).toLowerCase() + model.name.slice(1);
    const delegate = client[modelKey];
    if (delegate) patchReadMethods(delegate);
  }
}
