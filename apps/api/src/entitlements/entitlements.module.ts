import { Module } from "@nestjs/common";
import { EntitlementsService } from "./entitlements.service";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  providers: [EntitlementsService, PrismaService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
