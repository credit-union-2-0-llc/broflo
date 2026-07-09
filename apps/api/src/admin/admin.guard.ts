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
