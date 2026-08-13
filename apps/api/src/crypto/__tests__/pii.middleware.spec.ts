import type { PrismaClient } from "@prisma/client";
import { encryptData, decryptResult, piiExtension } from "../pii.middleware";
import { encrypt, isEncrypted } from "../crypto";

// 32-byte key as 64 hex chars.
const TEST_KEY = "a".repeat(64);

describe("pii.middleware", () => {
  beforeAll(() => {
    process.env.PII_ENCRYPTION_KEY = TEST_KEY;
  });

  describe("encryptData", () => {
    it("encrypts Order/AgentJob recipient shipping PII and leaves non-PII fields alone", () => {
      const data: Record<string, unknown> = {
        shippingName: "Alex Rivera",
        shippingAddress1: "1 Main St",
        shippingCity: "Ashland",
        status: "pending",
        priceCents: 5000,
      };
      encryptData(data);

      expect(isEncrypted(data.shippingName as string)).toBe(true);
      expect(isEncrypted(data.shippingAddress1 as string)).toBe(true);
      expect(isEncrypted(data.shippingCity as string)).toBe(true);
      expect(data.status).toBe("pending");
      expect(data.priceCents).toBe(5000);
    });

    it("leaves empty strings and absent fields untouched", () => {
      const data: Record<string, unknown> = { shippingName: "" };
      encryptData(data);
      expect(data.shippingName).toBe("");
    });
  });

  describe("decryptResult", () => {
    it("decrypts a nested relation such as order.person.name (the H3 gap)", () => {
      const order = {
        id: "o1",
        status: "ordered",
        shippingName: encrypt("Alex Rivera"),
        person: { name: encrypt("Sam Doe") },
      };
      decryptResult(order);
      expect(order.shippingName).toBe("Alex Rivera");
      expect(order.person.name).toBe("Sam Doe");
    });

    it("walks arrays and passes plaintext / Date / number values through unchanged", () => {
      const placedAt = new Date("2026-01-01T00:00:00Z");
      const rows = [
        { shippingName: encrypt("Enc Name"), city: "PlainCity", priceCents: 100, placedAt },
        { shippingName: "already plaintext", nested: { deep: encrypt("Deep") } },
      ];
      decryptResult(rows);

      expect(rows[0].shippingName).toBe("Enc Name");
      expect(rows[0].city).toBe("PlainCity");
      expect(rows[0].priceCents).toBe(100);
      expect(rows[0].placedAt).toBe(placedAt);
      expect(rows[1].shippingName).toBe("already plaintext");
      expect((rows[1].nested as { deep: string }).deep).toBe("Deep");
    });

    it("decrypts encrypted string elements inside array PII fields (allergens/dietaryRestrictions)", () => {
      const person = {
        name: encrypt("Sam"),
        allergens: [encrypt("peanuts"), encrypt("shellfish")],
        dietaryRestrictions: [encrypt("vegan")],
        hobbies: ["hiking", "reading"], // plaintext, non-PII array — untouched
      };
      decryptResult(person);
      expect(person.name).toBe("Sam");
      expect(person.allergens).toEqual(["peanuts", "shellfish"]);
      expect(person.dietaryRestrictions).toEqual(["vegan"]);
      expect(person.hobbies).toEqual(["hiking", "reading"]);
    });

    it("is a no-op on null and primitives", () => {
      expect(() => decryptResult(null)).not.toThrow();
      expect(() => decryptResult("str")).not.toThrow();
      expect(() => decryptResult(42)).not.toThrow();
    });
  });

  describe("piiExtension wiring", () => {
    it("encrypts order writes at rest but returns decrypted data, and decrypts reads incl. nested person", async () => {
      const persisted: Record<string, unknown> = {};
      const fakeOrder = {
        create: jest.fn(async (args: { data: Record<string, unknown> }) => {
          Object.assign(persisted, args.data); // capture what hit the DB
          return { ...args.data }; // DB echoes the (encrypted) row back
        }),
        findFirst: jest.fn(async () => ({
          shippingName: encrypt("Alex"),
          person: { name: encrypt("Sam") },
        })),
      };

      const client = { order: fakeOrder } as unknown as PrismaClient;
      piiExtension(client);

      const created = (await fakeOrder.create({
        data: { shippingName: "Alex", status: "pending" },
      })) as Record<string, unknown>;

      // Stored ciphertext...
      expect(isEncrypted(persisted.shippingName as string)).toBe(true);
      expect(persisted.status).toBe("pending");
      // ...but the caller gets plaintext back.
      expect(created.shippingName).toBe("Alex");

      const read = (await fakeOrder.findFirst()) as {
        shippingName: string;
        person: { name: string };
      };
      expect(read.shippingName).toBe("Alex");
      expect(read.person.name).toBe("Sam");
    });

    it("encrypts PII written inside an interactive $transaction (the tx-client bypass)", async () => {
      // Prisma hands a $transaction(async (tx) => …) callback a FRESH tx
      // client whose delegates are distinct from the top-level ones — so a
      // naive top-level-only patch leaves tx.person.create writing plaintext.
      // This models that: the tx client's person delegate writes to its own
      // sink, and the top-level patch must reach it via the $transaction wrap.
      const makePersonDelegate = (sink: Record<string, unknown>) => ({
        count: jest.fn(async () => 0),
        create: jest.fn(async (args: { data: Record<string, unknown> }) => {
          Object.assign(sink, args.data);
          return { ...args.data };
        }),
      });

      const txSink: Record<string, unknown> = {};
      const txClient = { person: makePersonDelegate(txSink) };

      const client = {
        person: makePersonDelegate({}),
        $transaction: (arg: unknown) =>
          typeof arg === "function"
            ? (arg as (tx: unknown) => unknown)(txClient)
            : Promise.all(arg as unknown[]),
      } as unknown as PrismaClient;

      piiExtension(client);

      const created = (await (client.$transaction as (fn: (tx: unknown) => unknown) => Promise<unknown>)(
        (tx: unknown) =>
          (tx as { person: { create: (a: unknown) => unknown } }).person.create({
            data: { name: "Alex", notes: "secret note" },
          }),
      )) as Record<string, unknown>;

      // What actually hit the DB inside the transaction is ciphertext...
      expect(isEncrypted(txSink.name as string)).toBe(true);
      expect(isEncrypted(txSink.notes as string)).toBe(true);
      // ...but the caller still gets plaintext back.
      expect(created.name).toBe("Alex");
      expect(created.notes).toBe("secret note");
    });
  });
});
