import { Injectable, type ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request } from "express";
import { isE2EHatchRequest } from "../util/e2e-hatch";

/**
 * Throttler that skips rate-limiting for triple-gated E2E test traffic.
 * Shares gate logic with TestingController and AuthService via isE2EHatchRequest.
 */
@Injectable()
export class E2EAwareThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const email = (req.body?.email ?? "").toString();
    if (!email) return false;
    return isE2EHatchRequest(req, email);
  }
}
