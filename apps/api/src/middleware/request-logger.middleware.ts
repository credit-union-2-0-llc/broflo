import { Logger } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";

const logger = new Logger("HTTP");

// Two route families carry a bearer-equivalent secret IN THE PATH: the family
// invite token (GET /family/invites/:token — unauthenticated preview, then
// accept) and the public survey token (GET /survey/:token, POST
// /survey/:token/submit). Logging
// req.originalUrl verbatim wrote those tokens to plaintext application logs
// (ops-platform finding a90ddcdd, 2026-09-18). Query strings can carry email
// addresses or tokens too, so they are dropped entirely: the path and status
// are what the log line is for.
const TOKEN_PATH = /(\/(?:family\/invites|survey)\/)[^/?#]+/g;

export function redactUrlForLog(url: string): string {
  const path = url.split(/[?#]/, 1)[0];
  return path.replace(TOKEN_PATH, "$1[redacted]");
}

export function RequestLoggerMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const start = Date.now();
  _res.on("finish", () => {
    const duration = Date.now() - start;
    logger.log(`${req.method} ${redactUrlForLog(req.originalUrl)} ${_res.statusCode} ${duration}ms`);
  });
  next();
}
