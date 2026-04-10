import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "@/app.module";
import { PrismaService } from "@/prisma/prisma.service";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    email: `test-${Date.now()}@broflo-e2e.com`,
    password: "Test1234!secure",
    name: "E2E Tester",
  };

  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors();
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up any leftover test user
    await prisma.user
      .deleteMany({ where: { email: testUser.email } })
      .catch(() => {});
  });

  afterAll(async () => {
    // Clean up test user and revoked tokens
    const user = await prisma.user
      .findUnique({ where: { email: testUser.email } })
      .catch(() => null);
    if (user) {
      await prisma.revokedToken.deleteMany({}).catch(() => {});
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
    await app.close();
  });

  // --- Health check ---

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

  // --- Signup ---

  describe("POST /auth/signup", () => {
    it("creates a new user and returns tokens", () => {
      return request(app.getHttpServer())
        .post("/auth/signup")
        .send(testUser)
        .expect(201)
        .expect((res: request.Response) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
          expect(res.body.user.email).toBe(testUser.email);
          expect(res.body.user.name).toBe(testUser.name);
          expect(res.body.user.subscriptionTier).toBe("free");
          // Should never expose password hash
          expect(res.body.user.passwordHash).toBeUndefined();

          accessToken = res.body.accessToken;
          refreshToken = res.body.refreshToken;
        });
    });

    it("rejects duplicate email", () => {
      return request(app.getHttpServer())
        .post("/auth/signup")
        .send(testUser)
        .expect(409);
    });

    it("rejects short password", () => {
      return request(app.getHttpServer())
        .post("/auth/signup")
        .send({ email: "short@test.com", password: "123", name: "Short" })
        .expect(400);
    });
  });

  // --- Login ---

  describe("POST /auth/login", () => {
    it("returns tokens for valid credentials", () => {
      return request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: testUser.email, password: testUser.password })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
          expect(res.body.user.email).toBe(testUser.email);

          // Update tokens for subsequent tests
          accessToken = res.body.accessToken;
          refreshToken = res.body.refreshToken;
        });
    });

    it("rejects wrong password", () => {
      return request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: testUser.email, password: "wrongpassword" })
        .expect(401);
    });

    it("rejects unknown email", () => {
      return request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "nobody@nowhere.com", password: "whatever1" })
        .expect(401);
    });
  });

  // --- GET /auth/me (protected) ---

  describe("GET /auth/me", () => {
    it("returns user profile with valid token", () => {
      return request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.email).toBe(testUser.email);
          expect(res.body.name).toBe(testUser.name);
          expect(res.body.subscriptionTier).toBe("free");
          // Should not expose sensitive fields
          expect(res.body.passwordHash).toBeUndefined();
          expect(res.body.refreshToken).toBeUndefined();
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

  // --- Refresh token rotation ---

  describe("POST /auth/refresh", () => {
    it("returns new tokens and rotates refresh token", () => {
      return request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
          // New refresh token should differ from old one (rotation)
          expect(res.body.refreshToken).not.toBe(refreshToken);

          // Old refresh token is now invalid, update for subsequent tests
          accessToken = res.body.accessToken;
          refreshToken = res.body.refreshToken;
        });
    });

    it("rejects old (rotated) refresh token", () => {
      const oldToken = "definitely-not-a-valid-refresh-token";
      return request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: oldToken })
        .expect(401);
    });
  });

  // --- Forgot password ---

  describe("POST /auth/forgot", () => {
    it("returns success for existing email (no enumeration leak)", () => {
      return request(app.getHttpServer())
        .post("/auth/forgot")
        .send({ email: testUser.email })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.message).toContain("reset link");
        });
    });

    it("returns success for non-existent email (no enumeration leak)", () => {
      return request(app.getHttpServer())
        .post("/auth/forgot")
        .send({ email: "nobody@nowhere.com" })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.message).toContain("reset link");
        });
    });
  });

  // --- Reset password ---

  describe("POST /auth/reset", () => {
    let resetToken: string;

    beforeAll(async () => {
      // Set a reset token directly in the DB for testing
      resetToken = "test-reset-token-" + Date.now();
      await prisma.user.update({
        where: { email: testUser.email },
        data: {
          resetToken,
          resetTokenExpires: new Date(Date.now() + 3600000), // 1 hour
        },
      });
    });

    it("resets password with valid token", () => {
      const newPassword = "NewSecure1234!";
      return request(app.getHttpServer())
        .post("/auth/reset")
        .send({ token: resetToken, password: newPassword })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.message).toContain("successful");
        });
    });

    it("can login with new password after reset", () => {
      return request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: testUser.email, password: "NewSecure1234!" })
        .expect(200)
        .expect((res: request.Response) => {
          accessToken = res.body.accessToken;
          refreshToken = res.body.refreshToken;
        });
    });

    it("rejects invalid reset token", () => {
      return request(app.getHttpServer())
        .post("/auth/reset")
        .send({ token: "bogus-token", password: "NewPass1234!" })
        .expect(400);
    });

    it("rejects short password on reset", () => {
      return request(app.getHttpServer())
        .post("/auth/reset")
        .send({ token: "any-token", password: "123" })
        .expect(400);
    });
  });

  // --- Logout ---

  describe("POST /auth/logout", () => {
    it("logs out and revokes token", async () => {
      // First get a fresh token
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: testUser.email, password: "NewSecure1234!" })
        .expect(200);

      const token = loginRes.body.accessToken;

      // Logout
      await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${token}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.message).toBe("Logged out");
        });

      // Revoked token should now be rejected
      await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
    });
  });

  // --- Protected route enforcement ---

  describe("Protected routes", () => {
    it("health endpoint is public (no auth needed)", () => {
      return request(app.getHttpServer()).get("/health").expect(200);
    });

    it("auth/me requires authentication", () => {
      return request(app.getHttpServer()).get("/auth/me").expect(401);
    });
  });
});
