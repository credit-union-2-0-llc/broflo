import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, ForbiddenException, GoneException, HttpException, NotFoundException } from "@nestjs/common";
import type { User } from "@prisma/client";
import { SurveyService } from "../survey.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { EmailService } from "../../email/email.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { PersonsService } from "../../persons/persons.service";
import { EntitlementsService } from "../../entitlements/entitlements.service";

describe("SurveyService", () => {
  let service: SurveyService;
  let prisma: {
    person: { findFirst: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
    personSurveyLink: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    personSurveyResponse: { create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    user: { findUniqueOrThrow: jest.Mock };
  };
  let redis: { checkSurveySendRateLimit: jest.Mock };
  let email: { sendSurveyInvite: jest.Mock };
  let notifications: { create: jest.Mock };
  let persons: { update: jest.Mock };
  let entitlements: { isFeatureEnabled: jest.Mock };

  const PERSON = { id: "person-1", userId: "user-1", name: "Alice Smith", recipientEmail: null };
  const USER = { id: "user-1", name: "Jasper", email: "jasper@example.com", subscriptionTier: "pro" } as User;

  beforeEach(async () => {
    prisma = {
      person: {
        findFirst: jest.fn().mockResolvedValue(PERSON),
        findUniqueOrThrow: jest.fn().mockResolvedValue(PERSON),
        update: jest.fn().mockResolvedValue({}),
      },
      personSurveyLink: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "link-1" }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      personSurveyResponse: {
        create: jest.fn().mockResolvedValue({ id: "resp-1" }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "user-1", name: "Jasper", email: "jasper@example.com" }),
      },
    };
    redis = { checkSurveySendRateLimit: jest.fn().mockResolvedValue({ allowed: true }) };
    email = { sendSurveyInvite: jest.fn().mockResolvedValue(undefined) };
    notifications = { create: jest.fn().mockResolvedValue({}) };
    persons = { update: jest.fn().mockResolvedValue({}) };
    entitlements = { isFeatureEnabled: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurveyService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: EmailService, useValue: email },
        { provide: NotificationsService, useValue: notifications },
        { provide: PersonsService, useValue: persons },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get(SurveyService);
  });

  describe("sendSurvey", () => {
    it("throws when the person has no recipient email and none is provided", async () => {
      await expect(service.sendSurvey(USER, "person-1", {})).rejects.toBeInstanceOf(BadRequestException);
      expect(email.sendSurveyInvite).not.toHaveBeenCalled();
    });

    it("sends using a provided recipientEmail and persists it on the person", async () => {
      await service.sendSurvey(USER, "person-1", { recipientEmail: "alice@example.com" });

      expect(prisma.person.update).toHaveBeenCalledWith({
        where: { id: "person-1" },
        data: { recipientEmail: "alice@example.com" },
      });
      expect(email.sendSurveyInvite).toHaveBeenCalledWith(
        "alice@example.com",
        "Jasper",
        "Alice",
        expect.any(String),
      );
    });

    it("throws when a survey was already sent recently (rate limited)", async () => {
      redis.checkSurveySendRateLimit.mockResolvedValue({ allowed: false });
      await expect(
        service.sendSurvey(USER, "person-1", { recipientEmail: "alice@example.com" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("denies sending for a person owned by someone else", async () => {
      prisma.person.findFirst.mockResolvedValue({ ...PERSON, userId: "someone-else" });
      await expect(
        service.sendSurvey(USER, "person-1", { recipientEmail: "alice@example.com" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("supersedes any still-active prior link", async () => {
      await service.sendSurvey(USER, "person-1", { recipientEmail: "alice@example.com" });
      expect(prisma.personSurveyLink.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ personId: "person-1", respondedAt: null }) }),
      );
    });

    it("rejects a Free-tier user before touching ownership or rate limits", async () => {
      entitlements.isFeatureEnabled.mockResolvedValue(false);
      const freeUser = { ...USER, subscriptionTier: "free" } as User;

      await expect(
        service.sendSurvey(freeUser, "person-1", { recipientEmail: "alice@example.com" }),
      ).rejects.toBeInstanceOf(HttpException);
      expect(prisma.person.findFirst).not.toHaveBeenCalled();
      expect(email.sendSurveyInvite).not.toHaveBeenCalled();
    });

    it("persists only the selected fields on the link, defaulting to all when none are chosen", async () => {
      await service.sendSurvey(USER, "person-1", { recipientEmail: "alice@example.com", fields: ["hobbies", "shoeSize"] });
      expect(prisma.personSurveyLink.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ fields: ["hobbies", "shoeSize"] }) }),
      );

      await service.sendSurvey(USER, "person-1", { recipientEmail: "alice@example.com" });
      const lastCall = prisma.personSurveyLink.create.mock.calls.at(-1)?.[0];
      expect(lastCall.data.fields.length).toBeGreaterThan(1);
    });
  });

  describe("getPublicSurvey / submitSurvey — token validation", () => {
    it("throws NotFoundException for an unknown token", async () => {
      prisma.personSurveyLink.findUnique.mockResolvedValue(null);
      await expect(service.getPublicSurvey("bogus")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws GoneException for an already-responded token", async () => {
      prisma.personSurveyLink.findUnique.mockResolvedValue({
        id: "link-1",
        personId: "person-1",
        respondedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        fields: [],
        person: { name: "Alice Smith" },
      });
      await expect(service.getPublicSurvey("used-token")).rejects.toBeInstanceOf(GoneException);
    });

    it("throws GoneException for an expired token", async () => {
      prisma.personSurveyLink.findUnique.mockResolvedValue({
        id: "link-1",
        personId: "person-1",
        respondedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        fields: [],
        person: { name: "Alice Smith" },
      });
      await expect(service.getPublicSurvey("expired-token")).rejects.toBeInstanceOf(GoneException);
    });

    it("returns the person's first name and every field when the link has no stored selection", async () => {
      prisma.personSurveyLink.findUnique.mockResolvedValue({
        id: "link-1",
        personId: "person-1",
        respondedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        fields: [],
        person: { name: "Alice Smith" },
      });
      const result = await service.getPublicSurvey("valid-token");
      expect(result.personFirstName).toBe("Alice");
      expect(result.fields).toContain("hobbies");
      expect(result.fields).not.toContain("shippingAddress1");
    });

    it("returns only the sender's selected fields when the link has a stored selection", async () => {
      prisma.personSurveyLink.findUnique.mockResolvedValue({
        id: "link-1",
        personId: "person-1",
        respondedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        fields: ["hobbies", "shoeSize"],
        person: { name: "Alice Smith" },
      });
      const result = await service.getPublicSurvey("valid-token");
      expect(result.fields).toEqual(["hobbies", "shoeSize"]);
    });

    it("submitSurvey creates a pending response and notifies the owner", async () => {
      prisma.personSurveyLink.findUnique.mockResolvedValue({
        id: "link-1",
        personId: "person-1",
        respondedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        fields: [],
        person: { name: "Alice Smith" },
      });

      await service.submitSurvey("valid-token", { hobbies: "climbing" });

      expect(prisma.personSurveyResponse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ personId: "person-1", surveyLinkId: "link-1", status: "pending" }),
        }),
      );
      expect(prisma.personSurveyLink.update).toHaveBeenCalledWith({
        where: { id: "link-1" },
        data: { respondedAt: expect.any(Date) },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ type: "survey_response" }),
      );
    });

    it("submitSurvey drops any answer outside the link's selected fields", async () => {
      prisma.personSurveyLink.findUnique.mockResolvedValue({
        id: "link-1",
        personId: "person-1",
        respondedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        fields: ["hobbies"],
        person: { name: "Alice Smith" },
      });

      await service.submitSurvey("valid-token", { hobbies: "climbing", musicTaste: "jazz" });

      expect(prisma.personSurveyResponse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ answers: { hobbies: "climbing" } }),
        }),
      );
    });

    it("submitSurvey rejects a second submission against the same (now-responded) token", async () => {
      prisma.personSurveyLink.findUnique.mockResolvedValue({
        id: "link-1",
        personId: "person-1",
        respondedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        fields: [],
        person: { name: "Alice Smith" },
      });
      await expect(service.submitSurvey("valid-token", { hobbies: "climbing" })).rejects.toBeInstanceOf(GoneException);
    });
  });

  describe("reviewResponse", () => {
    const RESPONSE = {
      id: "resp-1",
      personId: "person-1",
      status: "pending",
      answers: { hobbies: "climbing", musicTaste: "jazz" },
    };

    it("applies only the accepted fields via PersonsService.update", async () => {
      prisma.personSurveyResponse.findFirst.mockResolvedValue(RESPONSE);

      const result = await service.reviewResponse("user-1", "person-1", "resp-1", { fields: ["hobbies"] });

      expect(persons.update).toHaveBeenCalledWith("user-1", "person-1", { hobbies: "climbing" });
      expect(result.status).toBe("approved");
      expect(prisma.personSurveyResponse.update).toHaveBeenCalledWith({
        where: { id: "resp-1" },
        data: { status: "approved", reviewedAt: expect.any(Date) },
      });
    });

    it("applies all submitted fields when none are explicitly specified", async () => {
      prisma.personSurveyResponse.findFirst.mockResolvedValue(RESPONSE);

      await service.reviewResponse("user-1", "person-1", "resp-1", {});

      expect(persons.update).toHaveBeenCalledWith("user-1", "person-1", {
        hobbies: "climbing",
        musicTaste: "jazz",
      });
    });

    it("dismisses without touching the person record", async () => {
      prisma.personSurveyResponse.findFirst.mockResolvedValue(RESPONSE);

      const result = await service.reviewResponse("user-1", "person-1", "resp-1", { action: "dismiss" });

      expect(persons.update).not.toHaveBeenCalled();
      expect(result.status).toBe("dismissed");
    });

    it("throws when the response was already reviewed", async () => {
      prisma.personSurveyResponse.findFirst.mockResolvedValue({ ...RESPONSE, status: "approved" });
      await expect(
        service.reviewResponse("user-1", "person-1", "resp-1", {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("throws NotFoundException for a response belonging to a different person", async () => {
      prisma.personSurveyResponse.findFirst.mockResolvedValue(null);
      await expect(
        service.reviewResponse("user-1", "person-1", "resp-1", {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
