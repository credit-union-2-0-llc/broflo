import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { PhotoTagMergeService } from "./photo-tag-merge.service";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || "dev-ai-service-key";
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || "45000", 10);

export interface PhotoAnalysisJobData {
  photoId: string;
  personId: string;
  userId: string;
  category: string;
  tier: string;
  personName?: string;
}

@Processor("photo-analysis")
export class PhotoAnalysisProcessor {
  private readonly logger = new Logger(PhotoAnalysisProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tagMerge: PhotoTagMergeService,
  ) {}

  @Process({ concurrency: 2 })
  async handleAnalysis(job: Job<PhotoAnalysisJobData>): Promise<void> {
    const { photoId, personId, category, tier, personName } = job.data;

    this.logger.log(`Analyzing photo ${photoId} (category=${category}, tier=${tier})`);

    // Mark as processing
    await this.prisma.personPhoto.update({
      where: { id: photoId },
      data: { analysisStatus: "processing" },
    });

    try {
      // Read photo from blob storage
      const photo = await this.prisma.personPhoto.findUnique({
        where: { id: photoId },
      });
      if (!photo) {
        this.logger.warn(`Photo ${photoId} not found, skipping analysis`);
        return;
      }

      const imageBuffer = await this.storage.readPhoto(photo.blobPath);
      const imageBase64 = imageBuffer.toString("base64");

      // Call FastAPI /analyze-photo
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      try {
        const res = await fetch(`${AI_SERVICE_URL}/analyze-photo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Service-Key": AI_SERVICE_KEY,
          },
          body: JSON.stringify({
            image_base64: imageBase64,
            category,
            tier,
            person_name: personName || null,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`AI service returned ${res.status}: ${text}`);
        }

        const result = await res.json();

        // Store analysis result
        await this.prisma.personPhoto.update({
          where: { id: photoId },
          data: {
            analysisStatus: "complete",
            analysisJson: result.signals,
            analysisModel: result.model,
            analyzedAt: new Date(),
          },
        });

        // Merge extracted tags into person's dossier
        if (result.signals && result.signals.confidence >= 0.4) {
          await this.tagMerge.mergeSignals(personId, photoId, result.signals);
        }

        this.logger.log(
          `Photo ${photoId} analyzed successfully (model=${result.model}, confidence=${result.signals?.confidence})`,
        );
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      this.logger.error(`Photo analysis failed for ${photoId}:`, error);

      await this.prisma.personPhoto.update({
        where: { id: photoId },
        data: { analysisStatus: "failed" },
      });
    }
  }
}
