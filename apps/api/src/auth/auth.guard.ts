import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthenticatedRequest } from "./auth.types";
import { SESSION_COOKIE_NAME, SessionService } from "./session.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token !== "string" || token.length === 0) {
      throw new UnauthorizedException();
    }

    const session = await this.sessions.findActive(token);
    if (!session || !session.user.isActive) {
      throw new UnauthorizedException();
    }

    request.auth = {
      sessionId: session.id,
      user: {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        roles: session.user.roles.map(({ role }) => role.code),
        createdAt: session.user.createdAt,
      },
    };
    return true;
  }

}
