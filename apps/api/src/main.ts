import { useAzureMonitor } from "@azure/monitor-opentelemetry";

if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  useAzureMonitor();
}

import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { readFileSync } from "fs";
import { join } from "path";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./filters/global-exception.filter";
import { RequestLoggerMiddleware } from "./middleware/request-logger.middleware";

const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);

function validateProductionSecrets() {
  if (process.env.NODE_ENV !== "production") return;
  const log = new Logger("Bootstrap");
  const required = [
    "JWT_SECRET",
    "STRIPE_SECRET_KEY",
    "WEB_URL",
    "AI_SERVICE_URL",
    "AI_SERVICE_KEY",
    "AZURE_STORAGE_ACCOUNT_NAME",
    "AZURE_STORAGE_CONTAINER_NAME",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Fatal: missing required env vars in production: ${missing.join(", ")}`,
    );
  }
  const warned = [
    "BROWSER_AGENT_URL",
    "BROWSER_AGENT_SERVICE_KEY",
    "APPLICATIONINSIGHTS_CONNECTION_STRING",
  ].filter((k) => !process.env[k]);
  if (warned.length > 0) {
    log.warn(`Optional env vars not set (features degraded): ${warned.join(", ")}`);
  }
}

async function bootstrap() {
  validateProductionSecrets();
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableShutdownHooks();

  app.use(helmet());

  app.enableCors({
    origin: process.env.WEB_URL || "http://localhost:3000",
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(RequestLoggerMiddleware);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  new Logger("Bootstrap").log(`broflo-api v${pkg.version} listening on port ${port}`);
}

bootstrap();
