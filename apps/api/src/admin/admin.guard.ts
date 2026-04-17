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
  private readonly adminEmails: Set<string>;

  constructor() {
    const raw = process.env.ADMIN_EMAILS || "";
    this.adminEmails = new Set(
      raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
    );
    if (this.adminEmails.size === 0) {
      this.log.warn("ADMIN_EMAILS is empty — all admin requests will be denied");
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const route = `${request.method} ${request.path}`;

    if (!user?.email || !this.adminEmails.has(user.email.toLowerCase())) {
      this.log.warn(`Admin access denied: ${user?.email || "unknown"} → ${route}`);
      throw new ForbiddenException("Admin access required");
    }

    this.log.log(`Admin action: ${user.email} → ${route}`);
    return true;
  }
}
