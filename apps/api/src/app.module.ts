import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { HealthController } from "./health/health.controller";
import { PrismaService } from "./prisma/prisma.service";
import { AuthModule } from "./auth/auth.module";
import { PersonsModule } from "./persons/persons.module";
import { EventsModule } from "./events/events.module";
import { RemindersModule } from "./reminders/reminders.module";
import { SuggestionsModule } from "./suggestions/suggestions.module";
import { RedisModule } from "./redis/redis.module";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";

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
    AuthModule,
    PersonsModule,
    EventsModule,
    RemindersModule,
    RedisModule,
    SuggestionsModule,
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
