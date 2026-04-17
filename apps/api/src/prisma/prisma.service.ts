import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { piiMiddleware } from "../crypto/pii.middleware";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly log = new Logger(PrismaService.name);

  async onModuleInit() {
    this.$use(piiMiddleware());
    this.log.log("PII encryption middleware registered");
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
