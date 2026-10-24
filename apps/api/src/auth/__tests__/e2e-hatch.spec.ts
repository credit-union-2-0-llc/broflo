import type { Request } from "express";
import { isE2EHatchActive, isE2EHatchRequest } from "../util/e2e-hatch";

/**
 * Regression test for the "test-only hatch mounted via env flag" finding.
 *
 * The core guarantee: NODE_ENV === "production" hard-disables the E2E test
 * hatch even when E2E_TEST_HATCH_ENABLED === "1" is set — so a single stray env
 * var in prod can never arm the OTP-leaking endpoint or the rate-limit bypass.
 * These tests deliberately never set a shared-secret token: the production
 * check must win before any credential is even consulted.
 */
describe("E2E hatch production guard", () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    ENABLED: process.env.E2E_TEST_HATCH_ENABLED,
  };

  afterEach(() => {
    process.env.NODE_ENV = original.NODE_ENV;
    if (original.ENABLED === undefined) delete process.env.E2E_TEST_HATCH_ENABLED;
    else process.env.E2E_TEST_HATCH_ENABLED = original.ENABLED;
  });

  describe("isE2EHatchActive", () => {
    it("is DISABLED in production even when the flag is set to 1", () => {
      process.env.NODE_ENV = "production";
      process.env.E2E_TEST_HATCH_ENABLED = "1";
      expect(isE2EHatchActive()).toBe(false);
    });

    it("is enabled outside production when the flag is 1", () => {
      process.env.NODE_ENV = "test";
      process.env.E2E_TEST_HATCH_ENABLED = "1";
      expect(isE2EHatchActive()).toBe(true);
    });

    it("is disabled outside production when the flag is unset", () => {
      process.env.NODE_ENV = "test";
      delete process.env.E2E_TEST_HATCH_ENABLED;
      expect(isE2EHatchActive()).toBe(false);
    });
  });

  describe("isE2EHatchRequest", () => {
    // A request carrying a would-be-valid header — the production guard must
    // reject it before the token/allowlist checks ever run.
    const req = {
      header: () => "anything",
      headers: {},
    } as unknown as Request;

    it("refuses in production regardless of the enabled flag", () => {
      process.env.NODE_ENV = "production";
      process.env.E2E_TEST_HATCH_ENABLED = "1";
      // The production guard returns before the email/token is ever consulted,
      // so no address literal is needed (and none is committed).
      expect(isE2EHatchRequest(req, "")).toBe(false);
    });
  });
});
