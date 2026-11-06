import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export const SESSION_COOKIE_NAME = "ecommerse_session";
export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    database: Pick<PrismaClient, "session"> = this.prisma,
  ) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
    const session = await database.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    });

    return { token, session };
  }

  async findActive(token: string) {
    const now = new Date();
    return this.prisma.session.findFirst({
      where: {
        tokenHash: hashToken(token),
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        user: {
          include: {
            roles: { include: { role: true } },
          },
        },
      },
    });
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        tokenHash: hashToken(token),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }
}
