import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from "@nestjs/common";

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly log = new Logger(AdminGuard.name);

  // DB-backed User.isAdmin is the source of truth — replaces the old
  // ADMIN_EMAILS env allowlist, which required a redeploy to add/remove an
  // admin and could silently drift from who Kirk's team actually wants
  // admin access. isAdmin is seeded from the old ADMIN_EMAILS list already,
  // so this is a zero-downtime cutover, not a behavior change on deploy.
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const route = `${request.method} ${request.path}`;

    if (!user?.isAdmin) {
      this.log.warn(`Admin access denied: ${user?.email || "unknown"} → ${route}`);
      throw new ForbiddenException("Admin access required");
    }

    this.log.log(`Admin action: ${user.email} → ${route}`);
    return true;
  }
}
