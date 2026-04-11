import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  REQUIRED_TIER_KEY,
  type SubscriptionTier,
} from "../decorators/requires-tier.decorator";

const TIER_RANK: Record<string, number> = {
  free: 0,
  pro: 1,
  elite: 2,
};

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTiers = this.reflector.getAllAndOverride<
      SubscriptionTier[] | undefined
    >(REQUIRED_TIER_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredTiers || requiredTiers.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    const userRank = TIER_RANK[user.subscriptionTier] ?? 0;
    const minRequired = Math.min(
      ...requiredTiers.map((t) => TIER_RANK[t] ?? 0),
    );

    if (userRank >= minRequired) return true;

    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        message:
          "This feature requires a subscription upgrade.",
        upgradeUrl: "/upgrade",
        requiredTier: requiredTiers[0],
        currentTier: user.subscriptionTier,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
