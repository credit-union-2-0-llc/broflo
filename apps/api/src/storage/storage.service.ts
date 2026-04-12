import { Injectable, Logger } from "@nestjs/common";
import {
  BlobServiceClient,
  ContainerClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  SASProtocol,
} from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import sharp from "sharp";

const ACCOUNT_NAME =
  process.env.AZURE_STORAGE_ACCOUNT_NAME || "broflophotostore";
const CONTAINER_NAME =
  process.env.AZURE_STORAGE_CONTAINER_NAME || "photos";
const ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY || "";
const SAS_TTL_MINUTES = 15;
const THUMB_WIDTH = 400;
const THUMB_QUALITY = 80;
const MAX_DIMENSION = 1568; // Max for Claude Vision

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private containerClient: ContainerClient;
  private sharedKeyCred: StorageSharedKeyCredential | null = null;

  constructor() {
    if (ACCOUNT_KEY) {
      // Use shared key (local dev / explicit key)
      this.sharedKeyCred = new StorageSharedKeyCredential(
        ACCOUNT_NAME,
        ACCOUNT_KEY,
      );
      const blobService = new BlobServiceClient(
        `https://${ACCOUNT_NAME}.blob.core.windows.net`,
        this.sharedKeyCred,
      );
      this.containerClient = blobService.getContainerClient(CONTAINER_NAME);
    } else {
      // Use Managed Identity (Azure)
      const credential = new DefaultAzureCredential();
      const blobService = new BlobServiceClient(
        `https://${ACCOUNT_NAME}.blob.core.windows.net`,
        credential,
      );
      this.containerClient = blobService.getContainerClient(CONTAINER_NAME);
    }
  }

  /**
   * Re-encode image to JPEG via sharp.
   * Strips EXIF, resizes if too large, converts HEIC.
   */
  async processImage(
    buffer: Buffer,
  ): Promise<{ processed: Buffer; thumb: Buffer; width: number; height: number }> {
    const image = sharp(buffer).rotate(); // auto-orient from EXIF before stripping

    const metadata = await image.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    // Resize if exceeds max dimension (for Claude Vision)
    let pipeline = image;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Re-encode to JPEG — strips all EXIF/metadata by default
    const processed = await pipeline
      .jpeg({ quality: 85 })
      .toBuffer();

    // Generate thumbnail
    const thumb = await sharp(processed)
      .resize(THUMB_WIDTH, THUMB_WIDTH, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: THUMB_QUALITY })
      .toBuffer();

    return { processed, thumb, width, height };
  }

  /**
   * Upload processed image + thumbnail to Azure Blob Storage.
   */
  async uploadPhoto(
    userId: string,
    personId: string,
    photoId: string,
    imageBuffer: Buffer,
    thumbBuffer: Buffer,
  ): Promise<{ blobPath: string; thumbBlobPath: string }> {
    const blobPath = `${userId}/${personId}/${photoId}.jpg`;
    const thumbBlobPath = `${userId}/${personId}/${photoId}-thumb.jpg`;

    const blobClient = this.containerClient.getBlockBlobClient(blobPath);
    await blobClient.upload(imageBuffer, imageBuffer.length, {
      blobHTTPHeaders: { blobContentType: "image/jpeg" },
    });

    const thumbClient = this.containerClient.getBlockBlobClient(thumbBlobPath);
    await thumbClient.upload(thumbBuffer, thumbBuffer.length, {
      blobHTTPHeaders: { blobContentType: "image/jpeg" },
    });

    return { blobPath, thumbBlobPath };
  }

  /**
   * Generate a read-only SAS URL for a blob (15-min TTL).
   */
  generateSasUrl(blobPath: string): string {
    if (!this.sharedKeyCred) {
      // Fallback: user delegation SAS requires async — for now, return direct URL
      // In production with Managed Identity, use user delegation key
      this.logger.warn(
        "No shared key credential — returning unsigned URL (dev mode)",
      );
      return `https://${ACCOUNT_NAME}.blob.core.windows.net/${CONTAINER_NAME}/${blobPath}`;
    }

    const expiresOn = new Date();
    expiresOn.setMinutes(expiresOn.getMinutes() + SAS_TTL_MINUTES);

    const sas = generateBlobSASQueryParameters(
      {
        containerName: CONTAINER_NAME,
        blobName: blobPath,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn,
        protocol: SASProtocol.Https,
      },
      this.sharedKeyCred,
    );

    return `https://${ACCOUNT_NAME}.blob.core.windows.net/${CONTAINER_NAME}/${blobPath}?${sas.toString()}`;
  }

  /**
   * Delete a blob and its thumbnail.
   */
  async deletePhoto(blobPath: string, thumbBlobPath?: string | null): Promise<void> {
    try {
      await this.containerClient
        .getBlockBlobClient(blobPath)
        .deleteIfExists();
    } catch (err) {
      this.logger.error(`Failed to delete blob ${blobPath}`, err);
    }

    if (thumbBlobPath) {
      try {
        await this.containerClient
          .getBlockBlobClient(thumbBlobPath)
          .deleteIfExists();
      } catch (err) {
        this.logger.error(`Failed to delete thumb ${thumbBlobPath}`, err);
      }
    }
  }

  /**
   * Read a blob into a Buffer (for sending to Vision API).
   */
  async readPhoto(blobPath: string): Promise<Buffer> {
    const blobClient = this.containerClient.getBlockBlobClient(blobPath);
    const response = await blobClient.download(0);
    const chunks: Buffer[] = [];
    for await (const chunk of response.readableStreamBody!) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
