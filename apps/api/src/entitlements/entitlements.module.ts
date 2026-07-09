import { Global, Module } from "@nestjs/common";
import { EntitlementsService } from "./entitlements.service";
import { PrismaService } from "../prisma/prisma.service";

@Global()
@Module({
  providers: [EntitlementsService, PrismaService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
