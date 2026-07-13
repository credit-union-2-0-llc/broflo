import { Test, TestingModule } from "@nestjs/testing";
import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { getQueueToken } from "@nestjs/bull";
import { PhotosService } from "../photos.service";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../../storage/storage.service";
import { RedisService } from "../../redis/redis.service";
import { EntitlementsService } from "../../entitlements/entitlements.service";
import type { User } from "@prisma/client";

// Real magic bytes for a JPEG, long enough to pass the size/type checks.
const JPEG_FILE = {
  buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(20)]),
  size: 23,
} as Express.Multer.File;

describe("PhotosService.uploadPhoto", () => {
  let service: PhotosService;
  let prisma: {
    person: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    personPhoto: { count: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    user: { findUniqueOrThrow: jest.Mock };
    $transaction: jest.Mock;
  };
  let storage: { processImage: jest.Mock; uploadPhoto: jest.Mock };
  let redis: { getCachedSuggestions: jest.Mock; setCachedSuggestions: jest.Mock };
  let entitlements: { getIntLimit: jest.Mock; isFeatureEnabled: jest.Mock };
  let queue: { add: jest.Mock };

  const FREE_USER = { id: "u1", subscriptionTier: "free" } as User;

  beforeEach(async () => {
    prisma = {
      person: {
        findFirst: jest.fn().mockResolvedValue({ id: "p1", userId: "u1", deletedAt: null, completenessScore: 0 }),
        findUnique: jest.fn().mockResolvedValue({ name: "Dad" }),
        update: jest.fn().mockResolvedValue({}),
      },
      personPhoto: {
        count: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "photo-1" }),
        update: jest.fn().mockResolvedValue({ id: "photo-1", category: "other" }),
        delete: jest.fn().mockResolvedValue({}),
      },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue(FREE_USER) },
      $transaction: jest.fn().mockImplementation(
        (arg: unknown[] | ((tx: unknown) => unknown)) =>
          Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(prisma),
      ),
    };
    storage = {
      processImage: jest.fn().mockResolvedValue({ processed: Buffer.alloc(10), thumb: Buffer.alloc(5) }),
      uploadPhoto: jest.fn().mockResolvedValue({ blobPath: "a/b.jpg", thumbBlobPath: "a/b_thumb.jpg" }),
    };
    redis = {
      getCachedSuggestions: jest.fn().mockResolvedValue(null),
      setCachedSuggestions: jest.fn().mockResolvedValue(undefined),
    };
    entitlements = {
      getIntLimit: jest.fn().mockResolvedValue(1),
      isFeatureEnabled: jest.fn().mockResolvedValue(false),
    };
    queue = { add: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotosService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: RedisService, useValue: redis },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: getQueueToken("photo-analysis"), useValue: queue },
      ],
    }).compile();

    service = module.get(PhotosService);
  });

  it("claims the quota slot and uploads successfully under the limit", async () => {
    prisma.personPhoto.count.mockResolvedValue(0);

    const result = await service.uploadPhoto(FREE_USER, "p1", JPEG_FILE);

    expect(prisma.personPhoto.create).toHaveBeenCalled();
    expect(storage.processImage).toHaveBeenCalled();
    expect(result.id).toBe("photo-1");
  });

  it("rejects when already at the free-tier 1-photo cap", async () => {
    prisma.personPhoto.count.mockResolvedValue(1);

    await expect(service.uploadPhoto(FREE_USER, "p1", JPEG_FILE)).rejects.toBeInstanceOf(HttpException);
    expect(prisma.personPhoto.create).not.toHaveBeenCalled();
    expect(storage.processImage).not.toHaveBeenCalled();
  });

  it("claims the slot inside a serializable transaction", async () => {
    prisma.personPhoto.count.mockResolvedValue(0);

    await service.uploadPhoto(FREE_USER, "p1", JPEG_FILE);

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  });

  it("regression: translates a Postgres serialization failure (two concurrent uploads racing for the last slot) into the same quota error, not a 500", async () => {
    prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Transaction failed due to a write conflict", {
        code: "P2034",
        clientVersion: "test",
      }),
    );

    await expect(service.uploadPhoto(FREE_USER, "p1", JPEG_FILE)).rejects.toBeInstanceOf(HttpException);
  });

  it("releases the claimed slot if image processing fails, instead of permanently burning this person's quota", async () => {
    prisma.personPhoto.count.mockResolvedValue(0);
    storage.processImage.mockRejectedValueOnce(new Error("corrupt image"));

    await expect(service.uploadPhoto(FREE_USER, "p1", JPEG_FILE)).rejects.toBeInstanceOf(HttpException);
    expect(prisma.personPhoto.delete).toHaveBeenCalledWith({ where: { id: "photo-1" } });
  });
});
