import { Module } from "@nestjs/common";
import { SurveyController } from "./survey.controller";
import { PublicSurveyController } from "./public-survey.controller";
import { SurveyService } from "./survey.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PersonsModule } from "../persons/persons.module";

@Module({
  imports: [PersonsModule],
  controllers: [SurveyController, PublicSurveyController],
  providers: [SurveyService, PrismaService, EmailService, NotificationsService],
})
export class SurveyModule {}
