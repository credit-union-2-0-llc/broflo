import { Module } from "@nestjs/common";
import { SuggestionsController } from "./suggestions.controller";
import { SuggestionsService } from "./suggestions.service";
import { ProductSearchService } from "./product-search.service";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  controllers: [SuggestionsController],
  providers: [SuggestionsService, ProductSearchService, PrismaService],
  exports: [SuggestionsService],
})
export class SuggestionsModule {}
