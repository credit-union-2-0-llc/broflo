import { Module } from "@nestjs/common";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";
import { EventsScheduler } from "./events.scheduler";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  controllers: [EventsController],
  providers: [EventsService, EventsScheduler, PrismaService],
  exports: [EventsService],
})
export class EventsModule {}
