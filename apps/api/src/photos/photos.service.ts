import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { RedisService } from "../redis/redis.service";
import type { PhotoCategory, User } from "@prisma/client";

// file-type is ESM-only; use dynamic import
async function detectFileType(
  buffer: Buffer,
): Promise<{ mime: string; ext: string } | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = await (Function('return import("file-type")')() as Promise<{
    fileTypeFromBuffer: (buf: Buffer) => Promise<{ mime: string; ext: string } | undefined>;
  }>);
  return mod.fileTypeFromBuffer(buffer);
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Tier photo limits per person
const TIER_LIMITS: Record<string, number> = {
  free: 1,
  pro: 5,
  elite: Infinity,
};

// Rate limits
const UPLOAD_RATE_LIMIT_PER_MIN = 3;
const UPLOAD_RATE_LIMIT_PER_HOUR = 20;

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly redis: RedisService,
  ) {}

  private async ensureOwnership(userId: string, personId: string) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, deletedAt: null },
    });
    if (!person) throw new NotFoundException("Person not found");
    if (person.userId !== userId) throw new ForbiddenException();
    return person;
  }

  private async checkRateLimit(userId: string): Promise<void> {
    const minuteKey = `photo-upload:min:${userId}`;
    const hourKey = `photo-upload:hour:${userId}`;

    const minCount = await this.redis.getCachedSuggestions(minuteKey);
    if (minCount && parseInt(minCount, 10) >= UPLOAD_RATE_LIMIT_PER_MIN) {
      throw new HttpException(
        "Upload rate limit exceeded. Try again in a minute.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const hourCount = await this.redis.getCachedSuggestions(hourKey);
    if (hourCount && parseInt(hourCount, 10) >= UPLOAD_RATE_LIMIT_PER_HOUR) {
      throw new HttpException(
        "Hourly upload limit reached. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async incrementRateLimit(userId: string): Promise<void> {
    const minuteKey = `photo-upload:min:${userId}`;
    const hourKey = `photo-upload:hour:${userId}`;

    const minVal = await this.redis.getCachedSuggestions(minuteKey);
    await this.redis.setCachedSuggestions(
      minuteKey,
      String((parseInt(minVal || "0", 10) || 0) + 1),
      60,
    );

    const hourVal = await this.redis.getCachedSuggestions(hourKey);
    await this.redis.setCachedSuggestions(
      hourKey,
      String((parseInt(hourVal || "0", 10) || 0) + 1),
      3600,
    );
  }

  async uploadPhoto(
    user: User,
    personId: string,
    file: Express.Multer.File,
    category: PhotoCategory = "other" as PhotoCategory,
  ) {
    await this.ensureOwnership(user.id, personId);

    // Rate limit
    await this.checkRateLimit(user.id);

    // File size check
    if (file.size > MAX_FILE_SIZE) {
      throw new HttpException(
        "File too large. Maximum size is 5MB.",
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    // Magic byte validation
    const detected = await detectFileType(file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      throw new HttpException(
        "Unsupported file type. Upload JPEG, PNG, WebP, or HEIC.",
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    // Tier quota check
    const tier = user.subscriptionTier;
    const limit = TIER_LIMITS[tier] ?? 1;
    const existingCount = await this.prisma.personPhoto.count({
      where: { personId, userId: user.id },
    });
    if (existingCount >= limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message:
            tier === "free"
              ? "Free accounts get 1 photo per person. Upgrade to Pro for 5 photos and AI analysis."
              : `Pro accounts can upload up to 5 photos per person. Upgrade to Elite for unlimited.`,
          upgradeUrl: "/upgrade",
          requiredTier: tier === "free" ? "pro" : "elite",
          currentTier: tier,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // Process image: re-encode to JPEG, strip EXIF, generate thumbnail
    const { processed, thumb } = await this.storage.processImage(file.buffer);

    // Create DB record (generates UUID for blob path)
    const photo = await this.prisma.personPhoto.create({
      data: {
        personId,
        userId: user.id,
        blobPath: "", // placeholder, update after upload
        category,
        mimeType: "image/jpeg", // always JPEG after re-encode
        fileSizeBytes: processed.length,
      },
    });

    // Upload to Azure Blob
    const { blobPath, thumbBlobPath } = await this.storage.uploadPhoto(
      user.id,
      personId,
      photo.id,
      processed,
      thumb,
    );

    // Update with actual blob paths
    const updated = await this.prisma.personPhoto.update({
      where: { id: photo.id },
      data: { blobPath, thumbBlobPath },
    });

    // Recompute completeness score
    await this.recomputeCompleteness(personId);

    // Increment rate limit counters
    await this.incrementRateLimit(user.id);

    return updated;
  }

  async getPhotos(userId: string, personId: string) {
    await this.ensureOwnership(userId, personId);
    const photos = await this.prisma.personPhoto.findMany({
      where: { personId },
      orderBy: { createdAt: "desc" },
    });

    // Attach SAS URLs for thumbnails
    return photos.map((p) => ({
      ...p,
      thumbUrl: p.thumbBlobPath
        ? this.storage.generateSasUrl(p.thumbBlobPath)
        : null,
    }));
  }

  async getPhotoUrl(userId: string, personId: string, photoId: string) {
    await this.ensureOwnership(userId, personId);
    const photo = await this.prisma.personPhoto.findFirst({
      where: { id: photoId, personId },
    });
    if (!photo) throw new NotFoundException("Photo not found");

    return {
      url: this.storage.generateSasUrl(photo.blobPath),
      thumbUrl: photo.thumbBlobPath
        ? this.storage.generateSasUrl(photo.thumbBlobPath)
        : null,
    };
  }

  async deletePhoto(userId: string, personId: string, photoId: string) {
    await this.ensureOwnership(userId, personId);
    const photo = await this.prisma.personPhoto.findFirst({
      where: { id: photoId, personId },
    });
    if (!photo) throw new NotFoundException("Photo not found");

    // Delete blob
    await this.storage.deletePhoto(photo.blobPath, photo.thumbBlobPath);

    // Delete DB record (photo-derived tags persist per Kirk's decision)
    await this.prisma.personPhoto.delete({ where: { id: photoId } });

    // Recompute completeness score
    await this.recomputeCompleteness(personId);
  }

  private async recomputeCompleteness(personId: string): Promise<void> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
    });
    if (!person) return;

    const photoCount = await this.prisma.personPhoto.count({
      where: { personId },
    });

    // +8 for having at least one photo (approved at G21)
    let score = 0;
    if (person.hobbies) score += 15;
    if (person.favoriteBrands) score += 12;
    if (person.budgetMinCents || person.budgetMaxCents) score += 12;
    if (person.foodPreferences) score += 10;
    if (person.birthday) score += 10;
    if (
      person.shippingAddress1 &&
      person.shippingCity &&
      person.shippingState &&
      person.shippingZip
    )
      score += 10;
    if (person.musicTaste) score += 7;
    if (person.clothingSizeTop || person.clothingSizeBottom) score += 6;
    if (person.allergens.length > 0) score += 5;
    if (person.shoeSize) score += 3;
    if (person.wishlistUrls) score += 5;
    if (person.notes) score += 3;
    if (person.anniversary) score += 2;
    if (photoCount > 0) score += 8;

    const capped = Math.min(score, 100);
    if (capped !== person.completenessScore) {
      await this.prisma.person.update({
        where: { id: personId },
        data: { completenessScore: capped },
      });
    }
  }
}
