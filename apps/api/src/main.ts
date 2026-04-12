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

async function bootstrap() {
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
