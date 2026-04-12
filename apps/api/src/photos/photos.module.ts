import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { PhotosController } from "./photos.controller";
import { PhotosService } from "./photos.service";
import { PhotoAnalysisProcessor } from "./photo-analysis.processor";
import { PhotoTagMergeService } from "./photo-tag-merge.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "photo-analysis",
    }),
  ],
  controllers: [PhotosController],
  providers: [PhotosService, PhotoAnalysisProcessor, PhotoTagMergeService],
  exports: [PhotosService],
})
export class PhotosModule {}
