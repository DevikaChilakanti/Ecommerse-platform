import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "../src/generated/prisma/client";
import request = require("supertest");
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { SessionService } from "../src/auth/session.service";
import { PrismaService } from "../src/prisma/prisma.service";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/test";
process.env.FRONTEND_ORIGIN ??= "http://localhost:3000";

const productIds = {
  usd: "00000000-0000-4000-8000-000000000001",
  eur: "00000000-0000-4000-8000-000000000002",
  unavailable: "00000000-0000-4000-8000-000000000003",
};
const cartItemId = "00000000-0000-4000-8000-000000000011";

describe("Shopping cart endpoints", () => {
  let app: INestApplication;
  let carts: Map<string, { id: string; userId: string; items: CartItem[] }>;
  let nextItemNumber: number;

  interface CartItem {
    id: string;
    cartId: string;
    productId: string;
    quantity: number;
  }

  const products = {
    [productIds.usd]: {
      id: productIds.usd,
      name: "Widget",
      slug: "widget",
      price: new Prisma.Decimal("0.10"),
      currencyCode: "USD",
      isPublished: true,
      deletedAt: null,
      category: { isActive: true },
    },
    [productIds.eur]: {
      id: productIds.eur,
      name: "Gadget",
      slug: "gadget",
      price: new Prisma.Decimal("2.25"),
      currencyCode: "EUR",
      isPublished: true,
      deletedAt: null,
      category: { isActive: true },
    },
    [productIds.unavailable]: {
      id: productIds.unavailable,
      name: "Hidden product",
      slug: "hidden-product",
      price: new Prisma.Decimal("100.00"),
      currencyCode: "USD",
      isPublished: false,
      deletedAt: null,
      category: { isActive: true },
    },
  };

  const currentUserId = (requestUserId: string) =>
    requestUserId === "customer-two" ? "user-two" : "user-one";

  function cartFor(userId: string) {
    return [...carts.values()].find((cart) => cart.userId === userId);
  }

  function toRecord(cart: { id: string; userId: string; items: CartItem[] }) {
    return {
      id: cart.id,
      userId: cart.userId,
      items: cart.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        product: products[item.productId as keyof typeof products],
      })),
    };
  }

  const transactionMock = {
    cart: {
      findFirst: jest.fn(async ({ where }) => {
        const cart = cartFor(where.userId);
        return cart ? toRecord(cart) : null;
      }),
      findUnique: jest.fn(async ({ where }) => {
        const cart = carts.get(where.id);
        return cart ? toRecord(cart) : null;
      }),
      create: jest.fn(async ({ data }) => {
        const cart = {
          id: `cart-${data.userId}`,
          userId: data.userId,
          items: [],
        };
        carts.set(cart.id, cart);
        return { id: cart.id };
      }),
    },
    cartItem: {
      findUnique: jest.fn(async ({ where }) => {
        const cart = carts.get(where.cartId_productId.cartId);
        return (
          cart?.items.find(
            (item) => item.productId === where.cartId_productId.productId,
          ) ?? null
        );
      }),
      findFirst: jest.fn(async ({ where }) => {
        const cart = carts.get(where.cartId);
        return cart?.items.find((item) => item.id === where.id) ?? null;
      }),
      upsert: jest.fn(async ({ where, create, update }) => {
        const cart = carts.get(where.cartId_productId.cartId);
        if (!cart) {
          throw new Error("Cart fixture missing.");
        }
        let item = cart.items.find(
          (existing) =>
            existing.productId === where.cartId_productId.productId,
        );
        if (!item) {
          nextItemNumber += 1;
          item = {
            id:
              nextItemNumber === 1
                ? cartItemId
                : `00000000-0000-4000-8000-${String(nextItemNumber).padStart(12, "0")}`,
            cartId: create.cartId,
            productId: create.productId,
            quantity: create.quantity,
          };
          cart.items.push(item);
        } else {
          item.quantity += update.quantity.increment;
        }
        return { id: item.id };
      }),
      update: jest.fn(async ({ where, data }) => {
        const item = [...carts.values()]
          .flatMap((cart) => cart.items)
          .find((existing) => existing.id === where.id);
        if (!item) {
          throw new Error("Cart item fixture missing.");
        }
        item.quantity = data.quantity;
        return item;
      }),
      delete: jest.fn(async ({ where }) => {
        for (const cart of carts.values()) {
          cart.items = cart.items.filter((item) => item.id !== where.id);
        }
      }),
      deleteMany: jest.fn(async ({ where }) => {
        const cart = carts.get(where.cartId);
        if (!cart) {
          return { count: 0 };
        }
        const count = cart.items.length;
        cart.items = [];
        return { count };
      }),
    },
    product: {
      findFirst: jest.fn(async ({ where }) => {
        const product = products[where.id as keyof typeof products];
        return product?.isPublished && !product.deletedAt &&
          product.category.isActive
          ? { id: product.id }
          : null;
      }),
    },
  };
  const prismaMock = {
    ...transactionMock,
    $transaction: jest.fn(
      (operation: (transaction: typeof transactionMock) => Promise<unknown>) =>
        operation(transactionMock),
    ),
  };

  const sessionMock = {
    findActive: jest.fn(async (token: string) => ({
      id: "session-id",
      user: {
        id: currentUserId(token),
        email: `${token}@example.test`,
        firstName: "Cart",
        lastName: "Customer",
        createdAt: new Date(),
        isActive: true,
        roles: [
          { role: { code: token === "admin" ? "ADMIN" : "CUSTOMER" } },
        ],
      },
    })),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(SessionService)
      .useValue(sessionMock)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    carts = new Map();
    nextItemNumber = 0;
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it("requires a CUSTOMER session and GET does not create a cart", async () => {
    await request(app.getHttpServer()).get("/api/v1/cart").expect(401);
    await request(app.getHttpServer())
      .get("/api/v1/cart")
      .set("Cookie", "ecommerse_session=admin")
      .expect(403);

    const response = await request(app.getHttpServer())
      .get("/api/v1/cart")
      .set("Cookie", "ecommerse_session=customer-one")
      .expect(200);
    expect(response.body).toEqual({ id: null, items: [], totals: [] });
    expect(prismaMock.cart.create).not.toHaveBeenCalled();
  });

  it("adds, increments, updates, removes and clears cart items", async () => {
    const cookie = "ecommerse_session=customer-one";
    const first = await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Cookie", cookie)
      .send({ productId: productIds.usd, quantity: 2 })
      .expect(201);
    expect(first.body.items[0]).toMatchObject({
      productId: productIds.usd,
      quantity: 2,
      unitPrice: "0.1",
      lineTotal: "0.2",
    });

    const incremented = await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Cookie", cookie)
      .send({ productId: productIds.usd, quantity: 3 })
      .expect(201);
    expect(incremented.body.items[0].quantity).toBe(5);

    const itemId = incremented.body.items[0].id as string;
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/cart/items/${itemId}`)
      .set("Cookie", cookie)
      .send({ quantity: 4 })
      .expect(200);
    expect(updated.body.items[0].quantity).toBe(4);

    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/cart/items/${itemId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(removed.body.items).toEqual([]);
    expect(removed.body.id).toBe(first.body.id);

    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Cookie", cookie)
      .send({ productId: productIds.usd })
      .expect(201);
    const cleared = await request(app.getHttpServer())
      .delete("/api/v1/cart")
      .set("Cookie", cookie)
      .expect(200);
    expect(cleared.body).toMatchObject({ id: first.body.id, items: [], totals: [] });
    expect(carts.has(first.body.id)).toBe(true);
  });

  it("does not allow a second customer to update or remove another customer's item", async () => {
    const added = await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Cookie", "ecommerse_session=customer-one")
      .send({ productId: productIds.usd })
      .expect(201);
    const itemId = added.body.items[0].id as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/cart/items/${itemId}`)
      .set("Cookie", "ecommerse_session=customer-two")
      .send({ quantity: 2 })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/cart/items/${itemId}`)
      .set("Cookie", "ecommerse_session=customer-two")
      .expect(404);
    expect(added.body.items[0].quantity).toBe(1);
    expect(carts.get("cart-user-one")?.items[0].quantity).toBe(1);
  });

  it("validates UUIDs and item quantities and rejects unavailable products", async () => {
    const cookie = "ecommerse_session=customer-one";
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Cookie", cookie)
      .send({ productId: "not-a-uuid" })
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Cookie", cookie)
      .send({ productId: productIds.usd, quantity: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Cookie", cookie)
      .send({ productId: productIds.usd, quantity: 100 })
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Cookie", cookie)
      .send({ productId: productIds.unavailable })
      .expect(404);
    await request(app.getHttpServer())
      .patch("/api/v1/cart/items/not-a-uuid")
      .set("Cookie", cookie)
      .send({ quantity: 1 })
      .expect(400);
  });

  it("groups exact decimal subtotals by currency and excludes unavailable existing items", async () => {
    const cart = {
      id: "cart-user-one",
      userId: "user-one",
      items: [
        {
          id: cartItemId,
          cartId: "cart-user-one",
          productId: productIds.usd,
          quantity: 3,
        },
        {
          id: "00000000-0000-4000-8000-000000000012",
          cartId: "cart-user-one",
          productId: productIds.eur,
          quantity: 2,
        },
        {
          id: "00000000-0000-4000-8000-000000000013",
          cartId: "cart-user-one",
          productId: productIds.unavailable,
          quantity: 1,
        },
      ],
    };
    carts.set(cart.id, cart);

    const response = await request(app.getHttpServer())
      .get("/api/v1/cart")
      .set("Cookie", "ecommerse_session=customer-one")
      .expect(200);

    expect(response.body.totals).toEqual([
      { currencyCode: "EUR", subtotal: "4.5" },
      { currencyCode: "USD", subtotal: "0.3" },
    ]);
    expect(response.body.items[2].isAvailable).toBe(false);
    expect(response.body.items[2].lineTotal).toBe("100");
    expect(response.body).not.toHaveProperty("userId");
    expect(response.body.items[0]).not.toHaveProperty("createdAt");
    expect(response.body.items[0]).not.toHaveProperty("deletedAt");
    expect(response.body.items[0]).not.toHaveProperty("inventory");
  });

  it("rejects foreign identity fields instead of trusting request data", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Cookie", "ecommerse_session=customer-one")
      .send({ productId: productIds.usd, userId: "user-two" })
      .expect(400);
    expect(carts.size).toBe(0);
  });
});
