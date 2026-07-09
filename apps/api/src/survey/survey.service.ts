import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PersonsService } from "../persons/persons.service";
import { EntitlementsService } from "../entitlements/entitlements.service";
import type { UpdatePersonDto } from "../persons/dto/persons.dto";
import { SURVEY_FIELD_KEYS, type SendSurveyDto, type SubmitSurveyDto, type ReviewSurveyResponseDto } from "./dto/survey.dto";

const SURVEY_TTL_DAYS = 14;

@Injectable()
export class SurveyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    private readonly persons: PersonsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private async ensureOwnership(userId: string, personId: string) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, deletedAt: null },
    });
    if (!person) throw new NotFoundException("Person not found");
    if (person.userId !== userId) throw new ForbiddenException();
    return person;
  }

  async sendSurvey(user: User, personId: string, dto: SendSurveyDto) {
    if (!(await this.entitlements.isFeatureEnabled(user.subscriptionTier, "recipientSurvey"))) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: "Recipient surveys are a Pro feature. Upgrade to let people fill in their own details.",
          upgradeUrl: "/upgrade",
          currentTier: user.subscriptionTier,
          requiredTier: "pro",
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const person = await this.ensureOwnership(user.id, personId);

    const recipientEmail = dto.recipientEmail || person.recipientEmail;
    if (!recipientEmail) {
      throw new BadRequestException("No recipient email on file — provide one to send the survey.");
    }

    const rateLimit = await this.redis.checkSurveySendRateLimit(personId);
    if (!rateLimit.allowed) {
      throw new BadRequestException("A survey was already sent for this person recently. Try again tomorrow.");
    }

    if (dto.recipientEmail && dto.recipientEmail !== person.recipientEmail) {
      await this.prisma.person.update({
        where: { id: personId },
        data: { recipientEmail: dto.recipientEmail },
      });
    }

    // Superseding a previous, still-active link keeps things simple — only
    // the most recently sent link for a person is ever valid.
    await this.prisma.personSurveyLink.updateMany({
      where: { personId, respondedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SURVEY_TTL_DAYS * 24 * 60 * 60 * 1000);
    const fields = dto.fields && dto.fields.length > 0 ? dto.fields : [...SURVEY_FIELD_KEYS];

    await this.prisma.personSurveyLink.create({
      data: { personId, token, expiresAt, fields },
    });

    const giverName = user.name || user.email.split("@")[0];
    const recipientFirstName = person.name.split(" ")[0];

    await this.email.sendSurveyInvite(recipientEmail, giverName, recipientFirstName, token);

    return { sent: true };
  }

  private async getValidLink(token: string) {
    const link = await this.prisma.personSurveyLink.findUnique({
      where: { token },
      include: { person: { select: { name: true } } },
    });
    if (!link) throw new NotFoundException("Survey link not found");
    if (link.respondedAt) throw new GoneException("This survey has already been completed");
    if (link.expiresAt < new Date()) throw new GoneException("This survey link has expired");
    return link;
  }

  async getPublicSurvey(token: string) {
    const link = await this.getValidLink(token);
    const fields = link.fields.length > 0 ? link.fields : [...SURVEY_FIELD_KEYS];
    return {
      personFirstName: link.person.name.split(" ")[0],
      fields,
    };
  }

  async submitSurvey(token: string, dto: SubmitSurveyDto) {
    const link = await this.getValidLink(token);
    const allowedFields = new Set(link.fields.length > 0 ? link.fields : SURVEY_FIELD_KEYS);
    const answers = Object.fromEntries(
      Object.entries(dto).filter(([key]) => allowedFields.has(key)),
    );

    await this.prisma.personSurveyResponse.create({
      data: {
        personId: link.personId,
        surveyLinkId: link.id,
        answers: answers as never,
        status: "pending",
      },
    });

    await this.prisma.personSurveyLink.update({
      where: { id: link.id },
      data: { respondedAt: new Date() },
    });

    const person = await this.prisma.person.findUniqueOrThrow({ where: { id: link.personId } });
    await this.notifications.create(person.userId, {
      type: "survey_response",
      title: "Survey response ready to review",
      body: `${person.name} just filled out their survey — take a look.`,
      linkUrl: `/people/${person.id}`,
    });

    return { received: true };
  }

  async listResponses(userId: string, personId: string) {
    await this.ensureOwnership(userId, personId);
    return this.prisma.personSurveyResponse.findMany({
      where: { personId, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
  }

  async reviewResponse(
    userId: string,
    personId: string,
    responseId: string,
    dto: ReviewSurveyResponseDto,
  ) {
    await this.ensureOwnership(userId, personId);

    const response = await this.prisma.personSurveyResponse.findFirst({
      where: { id: responseId, personId },
    });
    if (!response) throw new NotFoundException("Survey response not found");
    if (response.status !== "pending") {
      throw new BadRequestException("This response has already been reviewed");
    }

    if (dto.action === "dismiss") {
      await this.prisma.personSurveyResponse.update({
        where: { id: responseId },
        data: { status: "dismissed", reviewedAt: new Date() },
      });
      return { status: "dismissed" };
    }

    const answers = response.answers as Record<string, unknown>;
    const acceptedKeys = dto.fields ?? Object.keys(answers);
    const updateData: Record<string, unknown> = {};
    for (const key of acceptedKeys) {
      if (key in answers && answers[key] !== undefined) {
        updateData[key] = answers[key];
      }
    }

    if (Object.keys(updateData).length > 0) {
      await this.persons.update(userId, personId, updateData as UpdatePersonDto);
    }

    await this.prisma.personSurveyResponse.update({
      where: { id: responseId },
      data: { status: "approved", reviewedAt: new Date() },
    });

    return { status: "approved", appliedFields: Object.keys(updateData) };
  }
}
