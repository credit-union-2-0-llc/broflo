import { TestingModule } from "../testing.module";

/**
 * Regression test for the "test-only controller mounted via env flag" finding.
 *
 * TestingModule exposes an authentication-bypassing E2E hatch. Its constructor
 * is a last-ditch hard assertion that it can never be instantiated in
 * production, independent of how AppModule evaluated the flag.
 */
describe("TestingModule production guard", () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    ENABLED: process.env.E2E_TEST_HATCH_ENABLED,
  };

  afterEach(() => {
    process.env.NODE_ENV = original.NODE_ENV;
    if (original.ENABLED === undefined) delete process.env.E2E_TEST_HATCH_ENABLED;
    else process.env.E2E_TEST_HATCH_ENABLED = original.ENABLED;
  });

  it("throws if constructed in production even with the flag set", () => {
    process.env.NODE_ENV = "production";
    process.env.E2E_TEST_HATCH_ENABLED = "1";
    expect(() => new TestingModule()).toThrow(/never load in production/);
  });

  it("throws if constructed with the hatch disabled", () => {
    process.env.NODE_ENV = "test";
    delete process.env.E2E_TEST_HATCH_ENABLED;
    expect(() => new TestingModule()).toThrow();
  });

  it("constructs when active outside production", () => {
    process.env.NODE_ENV = "test";
    process.env.E2E_TEST_HATCH_ENABLED = "1";
    expect(() => new TestingModule()).not.toThrow();
  });
});
