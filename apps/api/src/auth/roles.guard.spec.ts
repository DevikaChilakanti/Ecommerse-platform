import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthenticatedRequest } from "./auth.types";
import { RolesGuard } from "./roles.guard";

describe("RolesGuard", () => {
  const handler = jest.fn();
  const controller = jest.fn();
  let requiredRoles: string[] | undefined;
  const reflector = {
    getAllAndOverride: jest.fn(() => requiredRoles),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  function context(request: Partial<AuthenticatedRequest>) {
    return {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;
  }

  beforeEach(() => {
    requiredRoles = ["ADMIN"];
  });

  it("allows a principal with a required role", () => {
    expect(
      guard.canActivate(
        context({ auth: { sessionId: "session", user: {
          id: "user",
          email: "admin@example.test",
          firstName: "Admin",
          lastName: "User",
          roles: ["ADMIN"],
          createdAt: new Date(),
        } } }),
      ),
    ).toBe(true);
  });

  it("denies a customer where ADMIN is required", () => {
    expect(() =>
      guard.canActivate(
        context({ auth: { sessionId: "session", user: {
          id: "user",
          email: "customer@example.test",
          firstName: "Customer",
          lastName: "User",
          roles: ["CUSTOMER"],
          createdAt: new Date(),
        } } }),
      ),
    ).toThrow(ForbiddenException);
  });

  it("allows routes without role metadata", () => {
    requiredRoles = undefined;
    expect(guard.canActivate(context({}))).toBe(true);
  });
});
