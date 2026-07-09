import { Module } from "@nestjs/common";
import { FamilyController } from "./family.controller";
import { FamilyService } from "./family.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../notifications/notifications.service";

@Module({
  controllers: [FamilyController],
  providers: [FamilyService, PrismaService, EmailService, NotificationsService],
  exports: [FamilyService],
})
export class FamilyModule {}
