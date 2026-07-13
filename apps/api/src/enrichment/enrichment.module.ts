import { Module } from "@nestjs/common";
import { EnrichmentController } from "./enrichment.controller";
import { EnrichmentService } from "./enrichment.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProductSearchService } from "../suggestions/product-search.service";

@Module({
  controllers: [EnrichmentController],
  providers: [EnrichmentService, PrismaService, ProductSearchService],
  exports: [EnrichmentService],
})
export class EnrichmentModule {}
