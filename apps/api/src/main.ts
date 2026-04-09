import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./filters/global-exception.filter";
import { RequestLoggerMiddleware } from "./middleware/request-logger.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.WEB_URL || "http://localhost:3000",
    credentials: true,
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(RequestLoggerMiddleware);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`[broflo-api] listening on port ${port}`);
}

bootstrap();
