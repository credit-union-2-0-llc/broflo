import { Module } from "@nestjs/common";
import { PersonsController } from "./persons.controller";
import { PersonsService } from "./persons.service";
import { PrismaService } from "../prisma/prisma.service";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [EventsModule],
  controllers: [PersonsController],
  providers: [PersonsService, PrismaService],
  exports: [PersonsService],
})
export class PersonsModule {}
