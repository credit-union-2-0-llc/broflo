import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { BullModule } from "@nestjs/bull";
import { HealthController } from "./health/health.controller";
import { PrismaService } from "./prisma/prisma.service";
import { AuthModule } from "./auth/auth.module";
import { PersonsModule } from "./persons/persons.module";
import { EventsModule } from "./events/events.module";
import { RemindersModule } from "./reminders/reminders.module";
import { SuggestionsModule } from "./suggestions/suggestions.module";
import { GiftsModule } from "./gifts/gifts.module";
import { BillingModule } from "./billing/billing.module";
import { OrdersModule } from "./orders/orders.module";
import { AutopilotModule } from "./autopilot/autopilot.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { RedisModule } from "./redis/redis.module";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { E2EAwareThrottlerGuard } from "./auth/guards/e2e-aware-throttler.guard";
import { AgentOrdersModule } from "./orders/agent/agent-orders.module";
import { AdminModule } from "./admin/admin.module";
import { EnrichmentModule } from "./enrichment/enrichment.module";
import { StorageModule } from "./storage/storage.module";
import { PhotosModule } from "./photos/photos.module";
import { TestingModule } from "./testing/testing.module";

const TEST_HATCH_ENABLED = process.env.E2E_TEST_HATCH_ENABLED === "1";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 60000,
        limit: parseInt(process.env.THROTTLE_LIMIT || "10", 10),
      },
    ]),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      redis: process.env.REDIS_URL || "redis://localhost:6379",
    }),
    AuthModule,
    PersonsModule,
    EventsModule,
    RemindersModule,
    RedisModule,
    SuggestionsModule,
    GiftsModule,
    BillingModule,
    OrdersModule,
    AutopilotModule,
    NotificationsModule,
    AgentOrdersModule,
    AdminModule,
    EnrichmentModule,
    StorageModule,
    PhotosModule,
    ...(TEST_HATCH_ENABLED ? [TestingModule] : []),
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: E2EAwareThrottlerGuard,
    },
  ],
})
export class AppModule {}
