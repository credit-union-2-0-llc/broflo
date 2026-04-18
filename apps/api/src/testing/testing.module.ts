import { Module } from "@nestjs/common";
import { TestingController } from "./testing.controller";

/**
 * Conditionally imported by AppModule when E2E_TEST_HATCH_ENABLED === '1'.
 * RedisService is provided globally by RedisModule, so no explicit providers
 * needed here.
 */
@Module({
  controllers: [TestingController],
})
export class TestingModule {}
