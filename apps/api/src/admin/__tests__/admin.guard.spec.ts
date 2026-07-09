import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { AdminGuard } from "../admin.guard";

function buildContext(user: { email?: string; isAdmin?: boolean } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, method: "GET", path: "/admin/plans" }),
    }),
  } as unknown as ExecutionContext;
}

describe("AdminGuard", () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  it("allows a user with isAdmin=true", () => {
    expect(guard.canActivate(buildContext({ email: "a@b.com", isAdmin: true }))).toBe(true);
  });

  it("denies a user with isAdmin=false", () => {
    expect(() => guard.canActivate(buildContext({ email: "a@b.com", isAdmin: false }))).toThrow(
      ForbiddenException,
    );
  });

  it("denies when there's no user on the request", () => {
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
