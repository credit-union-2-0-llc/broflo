import { Module } from "@nestjs/common";
import { EnrichmentController } from "./enrichment.controller";
import { EnrichmentService } from "./enrichment.service";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  controllers: [EnrichmentController],
  providers: [EnrichmentService, PrismaService],
  exports: [EnrichmentService],
})
export class EnrichmentModule {}
