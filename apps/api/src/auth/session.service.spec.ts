import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import {
  SESSION_LIFETIME_MS,
  SessionService,
} from "./session.service";

describe("SessionService", () => {
  const sessionDelegate = {
    create: jest.fn().mockResolvedValue({
      id: "session-id",
      expiresAt: new Date(),
    }),
    findFirst: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const prisma = { session: sessionDelegate } as unknown as PrismaService;
  const service = new SessionService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates an opaque token and stores only its SHA-256 digest", async () => {
    const before = Date.now();
    const result = await service.create("user-id");
    const after = Date.now();
    const data = sessionDelegate.create.mock.calls[0][0].data;

    expect(result.token).toHaveLength(43);
    expect(data.tokenHash).toBe(
      createHash("sha256").update(result.token).digest("hex"),
    );
    expect(data.tokenHash).not.toBe(result.token);
    expect(data.userId).toBe("user-id");
    expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + SESSION_LIFETIME_MS,
    );
    expect(data.expiresAt.getTime()).toBeLessThanOrEqual(
      after + SESSION_LIFETIME_MS,
    );
  });

  it("queries only non-revoked, unexpired sessions by token digest", async () => {
    sessionDelegate.findFirst.mockResolvedValue(null);
    const token = "opaque-session-token";

    await service.findActive(token);

    expect(sessionDelegate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tokenHash: createHash("sha256").update(token).digest("hex"),
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        }),
        include: { user: { include: { roles: { include: { role: true } } } } },
      }),
    );
  });

  it("revokes sessions by digest without storing or querying the raw token", async () => {
    const token = "opaque-session-token";
    await service.revoke(token);

    expect(sessionDelegate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tokenHash: createHash("sha256").update(token).digest("hex"),
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      }),
    );
  });
});
