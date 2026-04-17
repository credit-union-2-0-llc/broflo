import { Prisma } from "@prisma/client";
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

function encryptField(value: unknown): unknown {
  if (typeof value === "string" && value.length > 0) return encrypt(value);
  return value;
}

function decryptField(value: unknown): unknown {
  if (typeof value === "string" && value.length > 0) return decrypt(value);
  return value;
}

function encryptData(data: Record<string, unknown>): void {
  for (const field of PII_STRING_FIELDS) {
    if (field in data && data[field] != null) {
      data[field] = encryptField(data[field]);
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

function decryptRecord(record: Record<string, unknown>): void {
  for (const field of PII_STRING_FIELDS) {
    if (record[field] != null) {
      record[field] = decryptField(record[field]);
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

function decryptResult(result: unknown): void {
  if (!result) return;
  if (Array.isArray(result)) {
    result.forEach((r) => decryptResult(r));
    return;
  }
  if (typeof result === "object") {
    decryptRecord(result as Record<string, unknown>);
  }
}

const WRITE_ACTIONS = ["create", "update", "upsert", "createMany"];
const READ_ACTIONS = [
  "findFirst",
  "findUnique",
  "findMany",
  "findFirstOrThrow",
  "findUniqueOrThrow",
];

export function piiMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    if (params.model !== "Person" || !hasKey()) {
      return next(params);
    }

    if (WRITE_ACTIONS.includes(params.action)) {
      const args = params.args as Record<string, unknown>;
      if (args.data && typeof args.data === "object") {
        encryptData(args.data as Record<string, unknown>);
      }
      if (
        params.action === "upsert" &&
        args.create &&
        typeof args.create === "object"
      ) {
        encryptData(args.create as Record<string, unknown>);
      }
      if (
        params.action === "upsert" &&
        args.update &&
        typeof args.update === "object"
      ) {
        encryptData(args.update as Record<string, unknown>);
      }
    }

    const result = await next(params);

    if (READ_ACTIONS.includes(params.action)) {
      decryptResult(result);
    }
    if (WRITE_ACTIONS.includes(params.action) && result) {
      decryptResult(result);
    }

    return result;
  };
}
