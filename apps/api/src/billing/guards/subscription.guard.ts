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
import { EntitlementsService } from "../../entitlements/entitlements.service";

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredTiers = this.reflector.getAllAndOverride<
      SubscriptionTier[] | undefined
    >(REQUIRED_TIER_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredTiers || requiredTiers.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    const plans = await this.entitlements.getAllPlans();
    const rank = new Map(plans.map((p, i) => [p.key, i]));

    const userRank = rank.get(user.subscriptionTier) ?? 0;
    const minRequired = Math.min(
      ...requiredTiers.map((t) => rank.get(t) ?? 0),
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
