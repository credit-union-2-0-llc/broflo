import type { Request, Response, NextFunction } from "express";

export function RequestLoggerMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const start = Date.now();
  _res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[broflo-api] ${req.method} ${req.originalUrl} ${_res.statusCode} ${duration}ms`,
    );
  });
  next();
}
