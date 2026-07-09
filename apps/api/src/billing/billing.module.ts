import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { FamilyModule } from "../family/family.module";

@Module({
  imports: [FamilyModule],
  controllers: [BillingController],
  providers: [BillingService, PrismaService, EmailService],
  exports: [BillingService],
})
export class BillingModule {}
