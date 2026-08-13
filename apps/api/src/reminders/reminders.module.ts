import { Module } from "@nestjs/common";
import { RemindersController } from "./reminders.controller";
import { RemindersService } from "./reminders.service";
import { RemindersScheduler } from "./reminders.scheduler";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  controllers: [RemindersController],
  providers: [RemindersService, RemindersScheduler, PrismaService],
})
export class RemindersModule {}
