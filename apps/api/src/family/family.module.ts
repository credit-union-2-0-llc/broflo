import { Module } from "@nestjs/common";
import { FamilyController } from "./family.controller";
import { FamilyService } from "./family.service";
import { SecretSantaController } from "./secret-santa.controller";
import { SecretSantaService } from "./secret-santa.service";
import { GiftPoolController } from "./gift-pool.controller";
import { GiftPoolService } from "./gift-pool.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../notifications/notifications.service";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [EventsModule],
  controllers: [FamilyController, SecretSantaController, GiftPoolController],
  providers: [
    FamilyService,
    SecretSantaService,
    GiftPoolService,
    PrismaService,
    EmailService,
    NotificationsService,
  ],
  exports: [FamilyService],
})
export class FamilyModule {}
