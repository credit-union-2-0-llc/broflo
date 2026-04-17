import { PrismaClient } from "@prisma/client";
import { encrypt, decrypt, hasKey } from "./crypto";

const PII_STRING_FIELDS = [
  "name",
  "shippingAddress1",
  "shippingAddress2",
  "shippingCity",
  "shippingState",
  "shippingZip",
] as const;

const PII_ARRAY_FIELDS = ["allergens", "dietaryRestrictions"] as const;

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

export function decryptRecord(record: Record<string, unknown>): void {
  for (const field of PII_STRING_FIELDS) {
    if (typeof record[field] === "string" && (record[field] as string).length > 0) {
      record[field] = decrypt(record[field] as string);
    }
  }
  for (const field of PII_ARRAY_FIELDS) {
    if (Array.isArray(record[field])) {
      record[field] = (record[field] as string[]).map((v) =>
        typeof v === "string" ? decrypt(v) : v,
      );
    }
  }
}

export function decryptResult(result: unknown): void {
  if (!result) return;
  if (Array.isArray(result)) {
    result.forEach((r) => decryptResult(r));
    return;
  }
  if (typeof result === "object") {
    decryptRecord(result as Record<string, unknown>);
  }
}

/**
 * Monkey-patch PrismaClient.person operations to encrypt/decrypt PII.
 * Prisma 6 removed $use — this wraps the model-level methods directly.
 */
export function piiExtension(prisma: PrismaClient): void {
  if (!hasKey()) return;

  const person = prisma.person as unknown as Record<string, unknown>;

  for (const method of ["create", "update", "upsert", "createMany"]) {
    const original = person[method] as (...args: unknown[]) => unknown;
    if (!original) continue;
    person[method] = (...args: unknown[]) => {
      const opts = args[0] as Record<string, unknown> | undefined;
      if (opts?.data && typeof opts.data === "object") {
        encryptData(opts.data as Record<string, unknown>);
      }
      if (method === "upsert" && opts?.create && typeof opts.create === "object") {
        encryptData(opts.create as Record<string, unknown>);
      }
      if (method === "upsert" && opts?.update && typeof opts.update === "object") {
        encryptData(opts.update as Record<string, unknown>);
      }
      const result = original.apply(person, args);
      if (result && typeof (result as Record<string, unknown>).then === "function") {
        return (result as Promise<unknown>).then((r) => {
          decryptResult(r);
          return r;
        });
      }
      return result;
    };
  }

  for (const method of ["findFirst", "findUnique", "findMany", "findFirstOrThrow", "findUniqueOrThrow"]) {
    const original = person[method] as (...args: unknown[]) => unknown;
    if (!original) continue;
    person[method] = (...args: unknown[]) => {
      const result = original.apply(person, args);
      if (result && typeof (result as Record<string, unknown>).then === "function") {
        return (result as Promise<unknown>).then((r) => {
          decryptResult(r);
          return r;
        });
      }
      return result;
    };
  }
}
