import { Controller, Get } from "@nestjs/common";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaService } from "../prisma/prisma.service";
import { Public } from "../auth/decorators/public.decorator";

const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8"),
);

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    let dbStatus = "ok";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "error";
    }

    return {
      status: "ok",
      version: pkg.version,
      uptime: process.uptime(),
      dependencies: {
        database: dbStatus,
      },
    };
  }
}
