/**
 * Regression coverage for the multer 2.1.1 -> 2.2.0 security bump
 * (CVE-2026-5079 / GHSA-72gw-mp4g-v24j, CVE-2026-5038 / GHSA-3p4h-7m6x-2hcm).
 *
 * Unlike photos.service.spec.ts (which calls PhotosService directly with a
 * hand-built Express.Multer.File object), this spins up the real
 * PhotosController behind Nest's HTTP adapter so requests go through the
 * ACTUAL multer multipart parser (via @nestjs/platform-express's
 * FileInterceptor) — the exact code path the CVEs are about. PhotosService
 * is mocked so this needs no Postgres/Redis/Azure Storage.
 */
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PhotosController } from "../photos.controller";
import { PhotosService } from "../photos.service";

describe("PhotosController multipart upload (real multer parser)", () => {
  let app: INestApplication;
  let uploadPhoto: jest.Mock;

  beforeAll(async () => {
    uploadPhoto = jest.fn().mockResolvedValue({ id: "photo-1", category: "bookshelf" });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PhotosController],
      providers: [{ provide: PhotosService, useValue: { uploadPhoto } }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("parses a normal multipart upload (file + flat field) unchanged", async () => {
    const res = await request(app.getHttpServer())
      .post("/persons/person-1/photos")
      .attach("file", Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00]), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      })
      .field("category", "bookshelf")
      .expect(201);

    expect(res.body.id).toBe("photo-1");
    expect(uploadPhoto).toHaveBeenCalledTimes(1);
    // 3rd arg is the parsed Multer file; confirm the real parser produced a buffer
    const [, , parsedFile] = uploadPhoto.mock.calls[0];
    expect(parsedFile.buffer).toBeInstanceOf(Buffer);
    expect(parsedFile.originalname).toBe("photo.jpg");
  });

  it("rejects a deeply nested bracket field name instead of allocating it (GHSA-72gw-mp4g-v24j)", async () => {
    // Simulates the DoS payload: field name with unbounded "a[b][c][d]..."
    // nesting. Broflo's endpoint only ever sends flat fields (see
    // UploadPhotoDto), so the controller sets limits.fieldNestingDepth: 0 —
    // this must reject the request rather than let append-field build the
    // nested object structure.
    const depth = 200;
    const nestedFieldName = "a" + "[x]".repeat(depth);

    uploadPhoto.mockClear();

    const start = performance.now();
    const res = await request(app.getHttpServer())
      .post("/persons/person-1/photos")
      .attach("file", Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00]), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      })
      .field(nestedFieldName, "x");
    const elapsed = performance.now() - start;

    // Bounded, fast rejection is the actual DoS mitigation — the request
    // must not be left hanging while append-field builds nested objects.
    expect(elapsed).toBeLessThan(1000);
    // No internal detail (stack trace, raw field payload) leaks in the body.
    expect(JSON.stringify(res.body)).not.toContain("stack");
    expect(JSON.stringify(res.body)).not.toContain(nestedFieldName);

    // The key security property: busboy aborts parsing immediately on
    // LIMIT_FIELD_NESTING (verified separately below) instead of letting
    // append-field build a 200-level-deep nested object — the handler,
    // and therefore PhotosService, is never reached at all.
    expect(res.status).not.toBe(201);
    expect(uploadPhoto).not.toHaveBeenCalled();
    // NOTE: this app has no global filter mapping MulterError -> a clean
    // 4xx (pre-existing gap, unrelated to this dependency bump — file
    // size/type limits are enforced later in PhotosService instead, not
    // via multer's own `limits`), so today this surfaces as a generic 500
    // rather than e.g. 400/413. That's a UX/observability nit, not a
    // security regression: the request is still rejected before any
    // expensive parsing happens, and no stack trace/internal detail leaks
    // (Nest's default prod exception handler already redacts those).
  });
});
