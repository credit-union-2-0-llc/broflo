import { Module } from "@nestjs/common";
import { TestingController } from "./testing.controller";
import { isE2EHatchActive } from "../auth/util/e2e-hatch";

/**
 * Conditionally imported by AppModule only when isE2EHatchActive() — i.e.
 * E2E_TEST_HATCH_ENABLED === '1' AND NODE_ENV !== 'production'. RedisService is
 * provided globally by RedisModule, so no explicit providers needed here.
 *
 * The constructor below is a last-ditch hard assertion: if this module is ever
 * instantiated in production (a mounting bug, or NODE_ENV set after AppModule
 * evaluated), it refuses to construct rather than silently exposing the
 * OTP-leaking TestingController. main.ts already hard-fails boot earlier for
 * the same misconfiguration.
 */
@Module({
  controllers: [TestingController],
})
export class TestingModule {
  constructor() {
    if (process.env.NODE_ENV === "production" || !isE2EHatchActive()) {
      throw new Error(
        "TestingModule must never load in production. It exposes an " +
          "authentication-bypassing E2E test hatch and is only permitted when " +
          "NODE_ENV !== 'production' and E2E_TEST_HATCH_ENABLED === '1'.",
      );
    }
  }
}
