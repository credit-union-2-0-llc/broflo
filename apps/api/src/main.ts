import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
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
  const required = [
    "STRIPE_SECRET_KEY",
    "AI_SERVICE_KEY",
    "JWT_SECRET",
    "BROWSER_AGENT_SERVICE_KEY",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Fatal: missing required secrets in production: ${missing.join(", ")}`,
    );
  }
}

async function bootstrap() {
  validateProductionSecrets();
  const app = await NestFactory.create(AppModule, { rawBody: true });

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
  console.log(`[broflo-api] v${pkg.version} listening on port ${port}`);
}

bootstrap();
