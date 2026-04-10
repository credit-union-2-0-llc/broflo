import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "@/app.module";
import { PrismaService } from "@/prisma/prisma.service";

describe("Persons (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;
  let personId: string;
  let neverAgainId: string;

  const testEmail = `persons-e2e-${Date.now()}@broflo.test`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    // Create a test user and get a token
    const res = await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ email: testEmail, password: "TestPass1234!", name: "Persons Tester" })
      .expect(201);

    accessToken = res.body.accessToken;
    userId = res.body.user.id;
  });

  afterAll(async () => {
    // Clean up: delete never-again items, persons, revoked tokens, user
    await prisma.neverAgainItem.deleteMany({ where: { person: { userId } } }).catch(() => {});
    await prisma.person.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.revokedToken.deleteMany({}).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await app.close();
  });

  // --- CREATE ---

  describe("POST /persons", () => {
    it("creates a person with basic fields", () => {
      return request(app.getHttpServer())
        .post("/persons")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "Sarah",
          relationship: "partner",
          birthday: "1995-01-15",
          budgetMinCents: 5000,
          budgetMaxCents: 15000,
        })
        .expect(201)
        .expect((res: request.Response) => {
          expect(res.body.name).toBe("Sarah");
          expect(res.body.relationship).toBe("partner");
          expect(res.body.budgetMinCents).toBe(5000);
          expect(res.body.budgetMaxCents).toBe(15000);
          expect(res.body.userId).toBe(userId);
          expect(res.body.neverAgainItems).toEqual([]);
          personId = res.body.id;
        });
    });

    it("creates a person with preferences", () => {
      return request(app.getHttpServer())
        .post("/persons")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "Mike",
          relationship: "friend",
          musicTaste: "indie rock",
          hobbies: "hiking, cooking",
          foodPreferences: "Thai",
        })
        .expect(201)
        .expect((res: request.Response) => {
          expect(res.body.musicTaste).toBe("indie rock");
          expect(res.body.hobbies).toBe("hiking, cooking");
        });
    });

    it("rejects unauthenticated request", () => {
      return request(app.getHttpServer())
        .post("/persons")
        .send({ name: "Nobody", relationship: "friend" })
        .expect(401);
    });
  });

  // --- LIST ---

  describe("GET /persons", () => {
    it("returns all persons for user", () => {
      return request(app.getHttpServer())
        .get("/persons")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.length).toBe(2);
          expect(res.body[0].userId).toBe(userId);
        });
    });
  });

  // --- GET ---

  describe("GET /persons/:id", () => {
    it("returns the person dossier", () => {
      return request(app.getHttpServer())
        .get(`/persons/${personId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.id).toBe(personId);
          expect(res.body.name).toBe("Sarah");
          expect(res.body.neverAgainItems).toBeDefined();
        });
    });

    it("returns 404 for unknown id", () => {
      return request(app.getHttpServer())
        .get("/persons/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  // --- UPDATE ---

  describe("PATCH /persons/:id", () => {
    it("updates budget range", () => {
      return request(app.getHttpServer())
        .patch(`/persons/${personId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Sarah", relationship: "partner", budgetMinCents: 7500, budgetMaxCents: 20000 })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.budgetMinCents).toBe(7500);
          expect(res.body.budgetMaxCents).toBe(20000);
        });
    });

    it("updates preferences", () => {
      return request(app.getHttpServer())
        .patch(`/persons/${personId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "Sarah",
          relationship: "partner",
          clothingSizeTop: "M",
          foodPreferences: "Thai, sushi",
        })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.clothingSizeTop).toBe("M");
          expect(res.body.foodPreferences).toBe("Thai, sushi");
        });
    });
  });

  // --- NEVER AGAIN ---

  describe("POST /persons/:id/never-again", () => {
    it("adds a never-again item", () => {
      return request(app.getHttpServer())
        .post(`/persons/${personId}/never-again`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ description: "generic candle" })
        .expect(201)
        .expect((res: request.Response) => {
          expect(res.body.description).toBe("generic candle");
          expect(res.body.personId).toBe(personId);
          neverAgainId = res.body.id;
        });
    });

    it("shows in person dossier", () => {
      return request(app.getHttpServer())
        .get(`/persons/${personId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.neverAgainItems.length).toBe(1);
          expect(res.body.neverAgainItems[0].description).toBe("generic candle");
        });
    });
  });

  describe("DELETE /persons/:id/never-again/:itemId", () => {
    it("removes the never-again item", () => {
      return request(app.getHttpServer())
        .delete(`/persons/${personId}/never-again/${neverAgainId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(204);
    });
  });

  // --- SOFT DELETE ---

  describe("DELETE /persons/:id", () => {
    it("soft deletes the person", () => {
      return request(app.getHttpServer())
        .delete(`/persons/${personId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(204);
    });

    it("deleted person no longer appears in list", () => {
      return request(app.getHttpServer())
        .get("/persons")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: request.Response) => {
          const ids = res.body.map((p: { id: string }) => p.id);
          expect(ids).not.toContain(personId);
        });
    });

    it("returns 404 for deleted person", () => {
      return request(app.getHttpServer())
        .get(`/persons/${personId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
