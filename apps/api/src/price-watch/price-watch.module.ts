import { Module } from "@nestjs/common";
import { PriceWatchScheduler } from "./price-watch.scheduler";
import { PrismaService } from "../prisma/prisma.service";
import { SuggestionsModule } from "../suggestions/suggestions.module";

@Module({
  imports: [SuggestionsModule],
  providers: [PriceWatchScheduler, PrismaService],
})
export class PriceWatchModule {}
