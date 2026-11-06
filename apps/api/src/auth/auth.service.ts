import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { PasswordService } from "./password.service";
import { SessionService } from "./session.service";
import { RoleCode, UserProfile } from "./auth.types";

type UserWithRoles = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  roles: Array<{ role: { code: RoleCode } }>;
};

function profileOf(user: UserWithRoles): UserProfile {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles.map(({ role }) => role.code),
    createdAt: user.createdAt,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  async register(input: RegisterDto) {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await this.passwords.hash(input.password);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const customerRole = await transaction.role.findUnique({
          where: { code: "CUSTOMER" },
          select: { id: true },
        });
        if (!customerRole) {
          throw new InternalServerErrorException(
            "Authentication roles are not configured.",
          );
        }

        const user = await transaction.user.create({
          data: {
            email,
            passwordHash,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            roles: {
              create: { role: { connect: { id: customerRole.id } } },
            },
          },
          include: { roles: { include: { role: true } } },
        });
        const { token } = await this.sessions.create(user.id, transaction);
        return { profile: profileOf(user), token };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        (error.meta?.target === "User_email_key" ||
          (Array.isArray(error.meta?.target) &&
            error.meta.target.includes("email")))
      ) {
        throw new ConflictException("An account with this email already exists.");
      }
      throw error;
    }
  }

  async login(input: LoginDto) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
    const validPassword = user
      ? await this.passwords.verify(input.password, user.passwordHash)
      : await this.passwords.verifyAgainstDummyHash(input.password);

    if (!user || !user.isActive || !validPassword) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const { token } = await this.sessions.create(user.id);
    return { profile: profileOf(user), token };
  }

  async logout(token?: string): Promise<void> {
    if (token) {
      await this.sessions.revoke(token);
    }
  }
}
