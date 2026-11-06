import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request = require("supertest");
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PasswordService } from "../src/auth/password.service";
import { PrismaService } from "../src/prisma/prisma.service";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.FRONTEND_ORIGIN ??= "http://localhost:3000";

describe("Authentication endpoints", () => {
  let app: INestApplication;
  const password = "correct horse battery";
  const user = {
    id: "user-uuid",
    email: "customer@example.test",
    passwordHash: "",
    firstName: "Casey",
    lastName: "Customer",
    isActive: true,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    roles: [{ role: { code: "CUSTOMER" } }],
  };
  let revoked = false;
  let currentRole = "CUSTOMER";
  let createdSessionData: { userId: string; tokenHash: string; expiresAt: Date };

  const transaction = {
    role: {
      findUnique: jest.fn().mockResolvedValue({ id: "customer-role" }),
    },
    user: {
      create: jest.fn().mockImplementation(async ({ data }) => ({
        ...user,
        email: data.email,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
      })),
    },
    session: {
      create: jest.fn().mockImplementation(async ({ data }) => {
        createdSessionData = data;
        return { id: "session-uuid", expiresAt: data.expiresAt };
      }),
    },
  };

  const prismaMock = {
    $transaction: jest.fn(
      async (operation: (tx: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    ),
    role: transaction.role,
    user: {
      findUnique: jest.fn().mockImplementation(async () => user),
    },
    session: {
      create: transaction.session.create,
      findFirst: jest.fn().mockImplementation(async () =>
        revoked
          ? null
          : {
              id: "session-uuid",
              user: {
                ...user,
                roles: [{ role: { code: currentRole } }],
              },
            },
      ),
      updateMany: jest.fn().mockImplementation(async () => {
        revoked = true;
        return { count: 1 };
      }),
    },
  };

  beforeAll(async () => {
    user.passwordHash = await new PasswordService().hash(password);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("registers customers and sets an HttpOnly seven-day session cookie", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "  CUSTOMER@example.test ",
        password,
        firstName: " Casey ",
        lastName: " Customer ",
      })
      .expect(201);

    expect(response.body).toEqual({
      id: user.id,
      email: "customer@example.test",
      firstName: "Casey",
      lastName: "Customer",
      roles: ["CUSTOMER"],
      createdAt: user.createdAt.toISOString(),
    });
    expect(response.body).not.toHaveProperty("passwordHash");
    expect(response.body).not.toHaveProperty("tokenHash");

    const cookie = response.headers["set-cookie"][0] as string;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=604800");
    const rawToken = cookie.split(";")[0].split("=")[1];
    expect(createdSessionData.tokenHash).not.toBe(rawToken);
    expect(createdSessionData.userId).toBe(user.id);
    expect(createdSessionData.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(transaction.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "customer@example.test",
          roles: {
            create: { role: { connect: { id: "customer-role" } } },
          },
        }),
      }),
    );
  });

  it("logs in, returns the current profile, then revokes and clears the session", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "CUSTOMER@example.test", password })
      .expect(200);
    const cookie = login.headers["set-cookie"][0] as string;
    expect(login.body.roles).toEqual(["CUSTOMER"]);
    expect(login.body).not.toHaveProperty("passwordHash");
    expect(cookie).toContain("HttpOnly");

    const profile = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Cookie", cookie.split(";")[0])
      .expect(200);
    expect(profile.body).toMatchObject({
      id: user.id,
      email: user.email,
      roles: ["CUSTOMER"],
    });
    expect(profile.body).not.toHaveProperty("passwordHash");
    expect(profile.body).not.toHaveProperty("tokenHash");

    currentRole = "ADMIN";
    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Cookie", cookie.split(";")[0])
      .expect(200)
      .expect((response) => {
        expect(response.body.roles).toEqual(["ADMIN"]);
      });
    currentRole = "CUSTOMER";

    const logout = await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Cookie", cookie.split(";")[0])
      .expect(204);
    expect(logout.headers["set-cookie"][0]).toContain(
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    );

    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Cookie", cookie.split(";")[0])
      .expect(401);
  });

  it("rejects invalid credentials and invalid registration input", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "CUSTOMER@example.test", password: "wrong password" })
      .expect(401)
      .expect({
        message: "Invalid email or password.",
        error: "Unauthorized",
        statusCode: 401,
      });

    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "new@example.test",
        password: "short",
        firstName: "New",
        lastName: "Customer",
        role: "ADMIN",
      })
      .expect(400);
  });

  it("denies protected requests without a session and clears cookies on repeated logout", async () => {
    await request(app.getHttpServer()).get("/api/v1/auth/me").expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Origin", "https://attacker.example")
      .expect(403);
    const logout = await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .expect(204);
    expect(logout.headers["set-cookie"][0]).toContain(
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    );
  });
});
