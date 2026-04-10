import { Module } from "@nestjs/common";
import { GiftsController } from "./gifts.controller";
import { GiftsService } from "./gifts.service";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  controllers: [GiftsController],
  providers: [GiftsService, PrismaService],
  exports: [GiftsService],
})
export class GiftsModule {}
