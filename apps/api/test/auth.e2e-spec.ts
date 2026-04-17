import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "@/app.module";
import { PrismaService } from "@/prisma/prisma.service";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testEmail = `test-${Date.now()}@broflo-e2e.com`;

  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors();
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.user
      .deleteMany({ where: { email: testEmail } })
      .catch(() => {});
  });

  afterAll(async () => {
    const user = await prisma.user
      .findUnique({ where: { email: testEmail } })
      .catch(() => null);
    if (user) {
      await prisma.revokedToken.deleteMany({}).catch(() => {});
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
    await app.close();
  });

  describe("GET /health", () => {
    it("returns ok", () => {
      return request(app.getHttpServer())
        .get("/health")
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.status).toBe("ok");
          expect(res.body.dependencies.database).toBe("ok");
        });
    });
  });

  describe("POST /auth/send-otp", () => {
    it("sends OTP and returns code in test mode", () => {
      return request(app.getHttpServer())
        .post("/auth/send-otp")
        .send({ email: testEmail })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.sent).toBe(true);
          expect(res.body.code).toBeDefined();
          expect(res.body.code).toHaveLength(6);
        });
    });

    it("rejects invalid email", () => {
      return request(app.getHttpServer())
        .post("/auth/send-otp")
        .send({ email: "not-an-email" })
        .expect(400);
    });
  });

  describe("POST /auth/verify-otp", () => {
    it("auto-creates user and returns tokens on first verify", async () => {
      const otpRes = await request(app.getHttpServer())
        .post("/auth/send-otp")
        .send({ email: testEmail })
        .expect(200);

      const code = otpRes.body.code;

      return request(app.getHttpServer())
        .post("/auth/verify-otp")
        .send({ email: testEmail, code })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
          expect(res.body.user.email).toBe(testEmail);
          expect(res.body.user.subscriptionTier).toBe("free");

          accessToken = res.body.accessToken;
          refreshToken = res.body.refreshToken;
        });
    });

    it("returns tokens for existing user on subsequent verify", async () => {
      const otpRes = await request(app.getHttpServer())
        .post("/auth/send-otp")
        .send({ email: testEmail })
        .expect(200);

      return request(app.getHttpServer())
        .post("/auth/verify-otp")
        .send({ email: testEmail, code: otpRes.body.code })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.user.email).toBe(testEmail);

          accessToken = res.body.accessToken;
          refreshToken = res.body.refreshToken;
        });
    });

    it("rejects wrong code", async () => {
      await request(app.getHttpServer())
        .post("/auth/send-otp")
        .send({ email: testEmail })
        .expect(200);

      return request(app.getHttpServer())
        .post("/auth/verify-otp")
        .send({ email: testEmail, code: "000000" })
        .expect(401);
    });

    it("code is single-use", async () => {
      const otpRes = await request(app.getHttpServer())
        .post("/auth/send-otp")
        .send({ email: testEmail })
        .expect(200);

      const code = otpRes.body.code;

      await request(app.getHttpServer())
        .post("/auth/verify-otp")
        .send({ email: testEmail, code })
        .expect(200);

      return request(app.getHttpServer())
        .post("/auth/verify-otp")
        .send({ email: testEmail, code })
        .expect(401);
    });
  });

  describe("GET /auth/me", () => {
    it("returns user profile with valid token", () => {
      return request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.email).toBe(testEmail);
          expect(res.body.subscriptionTier).toBe("free");
        });
    });

    it("returns 401 without token", () => {
      return request(app.getHttpServer()).get("/auth/me").expect(401);
    });

    it("returns 401 with invalid token", () => {
      return request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", "Bearer invalid.jwt.token")
        .expect(401);
    });
  });

  describe("POST /auth/refresh", () => {
    it("returns new tokens and rotates refresh token", () => {
      return request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
          expect(res.body.refreshToken).not.toBe(refreshToken);

          accessToken = res.body.accessToken;
          refreshToken = res.body.refreshToken;
        });
    });

    it("rejects invalid refresh token", () => {
      return request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: "bogus-token" })
        .expect(401);
    });
  });

  describe("POST /auth/logout", () => {
    it("logs out and revokes token", async () => {
      const otpRes = await request(app.getHttpServer())
        .post("/auth/send-otp")
        .send({ email: testEmail })
        .expect(200);

      const verifyRes = await request(app.getHttpServer())
        .post("/auth/verify-otp")
        .send({ email: testEmail, code: otpRes.body.code })
        .expect(200);

      const token = verifyRes.body.accessToken;

      await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${token}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.message).toBe("Logged out");
        });

      await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
    });
  });

  describe("Protected routes", () => {
    it("health endpoint is public", () => {
      return request(app.getHttpServer()).get("/health").expect(200);
    });

    it("auth/me requires authentication", () => {
      return request(app.getHttpServer()).get("/auth/me").expect(401);
    });
  });
});
