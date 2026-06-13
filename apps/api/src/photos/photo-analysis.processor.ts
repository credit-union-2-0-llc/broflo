import { Injectable, Logger } from '@nestjs/common';

export interface PhotoAnalysisJob {
  userId: string;
  personId: string;
  photoUrl: string;
  storagePath: string;
  tag?: string;
}

@Injectable()
export class PhotoAnalysisProcessor {
  private readonly logger = new Logger(PhotoAnalysisProcessor.name);

  async enqueue(job: PhotoAnalysisJob): Promise<void> {
    this.logger.log(
      `Enqueuing photo analysis job for person ${job.personId}, path: ${job.storagePath}`,
    );
    // In production this would push a job to a queue (e.g. BullMQ, Azure Service Bus)
    // For now this is a no-op stub that satisfies the type contract
  }
}