import { Logger } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";

const logger = new Logger("HTTP");

export function RequestLoggerMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const start = Date.now();
  _res.on("finish", () => {
    const duration = Date.now() - start;
    logger.log(`${req.method} ${req.originalUrl} ${_res.statusCode} ${duration}ms`);
  });
  next();
}
