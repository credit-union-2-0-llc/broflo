import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
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
import { AgentOrdersModule } from "./orders/agent/agent-orders.module";
import { AdminModule } from "./admin/admin.module";
import { EnrichmentModule } from "./enrichment/enrichment.module";
import { StorageModule } from "./storage/storage.module";
import { PhotosModule } from "./photos/photos.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 60000,
        limit: 10,
      },
    ]),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      redis: process.env.REDIS_URL
        ? { host: new URL(process.env.REDIS_URL).hostname, port: parseInt(new URL(process.env.REDIS_URL).port || "6379", 10) }
        : { host: "localhost", port: 6379 },
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
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
