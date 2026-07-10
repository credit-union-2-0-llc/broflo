import { Module } from "@nestjs/common";
import { FamilyController } from "./family.controller";
import { FamilyService } from "./family.service";
import { SecretSantaController } from "./secret-santa.controller";
import { SecretSantaService } from "./secret-santa.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../notifications/notifications.service";

@Module({
  controllers: [FamilyController, SecretSantaController],
  providers: [
    FamilyService,
    SecretSantaService,
    PrismaService,
    EmailService,
    NotificationsService,
  ],
  exports: [FamilyService],
})
export class FamilyModule {}
