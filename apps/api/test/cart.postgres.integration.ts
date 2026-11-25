import "./postgres-test-setup";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { Prisma } from "../src/generated/prisma/client";
import request = require("supertest");
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { SESSION_COOKIE_NAME, SessionService } from "../src/auth/session.service";
import { CartService } from "../src/cart/cart.service";
import { CustomerMutationQueue } from "../src/cart/customer-mutation-queue.service";
import { AddCartItemDto } from "../src/cart/dto/cart-item.dto";
import { OrdersService } from "../src/orders/orders.service";
import { PrismaService } from "../src/prisma/prisma.service";

const TEST_DATABASE_NAME = "ecommerse_test_db";
const CART_CONCURRENCY = 6;

interface CustomerFixture {
  id: string;
  cookie: string;
}

interface FixtureIds {
  userIds: string[];
  sessionIds: string[];
  categoryId?: string;
  productIds: string[];
}

interface CartFixture extends FixtureIds {
  customers: [CustomerFixture, CustomerFixture];
  categoryId: string;
}

describe("Shopping cart PostgreSQL integration", () => {
  jest.setTimeout(30_000);

  let app: INestApplication;
  let moduleFixture: TestingModule;
  let prisma: PrismaService;
  let prismaDisconnectSpy: jest.SpyInstance | undefined;
  let sessions: SessionService;
  let fixtureIds: FixtureIds;
  let fixture: CartFixture;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    prismaDisconnectSpy = jest.spyOn(prisma, "$disconnect");
    sessions = moduleFixture.get(SessionService);

    const databases = await prisma.$queryRaw<Array<{ databaseName: string }>>`
      SELECT current_database() AS "databaseName"
    `;
    if (databases[0]?.databaseName !== TEST_DATABASE_NAME) {
      throw new Error(
        "PostgreSQL cart tests refused to run outside ecommerse_test_db.",
      );
    }
  });

  beforeEach(async () => {
    fixtureIds = { userIds: [], sessionIds: [], productIds: [] };
    try {
      fixture = await createFixture(fixtureIds);
    } catch (error) {
      try {
        await cleanupFixture(fixtureIds);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "PostgreSQL cart fixture setup and cleanup both failed.",
        );
      }
      throw error;
    }
  });

  afterEach(async () => {
    await cleanupFixture(fixtureIds);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prismaDisconnectSpy) {
      expect(prismaDisconnectSpy).toHaveBeenCalledTimes(1);
    }
  });

  it("creates one active cart during concurrent first additions", async () => {
    const responses = await Promise.all(
      fixture.productIds.map((productId) =>
        request(app.getHttpServer())
          .post("/api/v1/cart/items")
          .set("Cookie", fixture.customers[0].cookie)
          .send({ productId, quantity: 1 })
          .expect(201),
      ),
    );

    const carts = await prisma.cart.findMany({
      where: { userId: fixture.customers[0].id, status: "ACTIVE" },
      include: { items: { select: { productId: true, quantity: true } } },
    });

    expect(carts).toHaveLength(1);
    expect(new Set(responses.map(({ body }) => body.id))).toEqual(
      new Set([carts[0].id]),
    );
    expect(carts[0].items).toHaveLength(fixture.productIds.length);
    expect(new Set(carts[0].items.map((item) => item.productId))).toEqual(
      new Set(fixture.productIds),
    );
    expect(carts[0].items.every((item) => item.quantity === 1)).toBe(true);
    expect(carts[0].userId).toBe(fixture.customers[0].id);
  });

  it("does not lose concurrent increments or create duplicate product items", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Cookie", fixture.customers[0].cookie)
      .send({ productId: fixture.productIds[0], quantity: 1 })
      .expect(201);

    const additions = await Promise.all(
      Array.from({ length: CART_CONCURRENCY }, () =>
        request(app.getHttpServer())
          .post("/api/v1/cart/items")
          .set("Cookie", fixture.customers[0].cookie)
          .send({ productId: fixture.productIds[0], quantity: 2 })
          .expect(201),
      ),
    );

    const ownedCarts = await prisma.cart.findMany({
      where: { userId: fixture.customers[0].id, status: "ACTIVE" },
      select: { id: true },
    });
    const items = await prisma.cartItem.findMany({
      where: {
        cartId: { in: ownedCarts.map(({ id }) => id) },
        productId: fixture.productIds[0],
      },
    });

    expect(ownedCarts).toHaveLength(1);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(1 + CART_CONCURRENCY * 2);
    expect(additions.every(({ body }) => body.id === ownedCarts[0].id)).toBe(
      true,
    );
  });

  it("serializes concurrent absolute quantity updates without changing ownership", async () => {
    const addResponse = await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Cookie", fixture.customers[0].cookie)
      .send({ productId: fixture.productIds[0], quantity: 1 })
      .expect(201);
    const itemId = addResponse.body.items[0].id as string;
    const requestedQuantities = [7, 18, 29, 41];

    await Promise.all(
      requestedQuantities.map((quantity) =>
        request(app.getHttpServer())
          .patch(`/api/v1/cart/items/${itemId}`)
          .set("Cookie", fixture.customers[0].cookie)
          .send({ quantity })
          .expect(200),
      ),
    );

    const foreignMutation = await request(app.getHttpServer())
      .patch(`/api/v1/cart/items/${itemId}`)
      .set("Cookie", fixture.customers[1].cookie)
      .send({ quantity: 99 })
      .expect(404);
    expect(foreignMutation.body.statusCode).toBe(404);

    const carts = await prisma.cart.findMany({
      where: { userId: fixture.customers[0].id, status: "ACTIVE" },
      include: { items: true },
    });
    const foreignCarts = await prisma.cart.findMany({
      where: { userId: fixture.customers[1].id, status: "ACTIVE" },
    });

    expect(carts).toHaveLength(1);
    expect(carts[0].items).toHaveLength(1);
    expect(requestedQuantities).toContain(carts[0].items[0].quantity);
    expect(carts[0].items[0].id).toBe(itemId);
    expect(carts[0].userId).toBe(fixture.customers[0].id);
    expect(foreignCarts).toHaveLength(0);
  });

  it("creates an order with snapshots and converts the active cart", async () => {
    const address = await addAddress(fixture.customers[0]);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Cookie", fixture.customers[0].cookie)
      .send({ productId: fixture.productIds[0], quantity: 2 })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post("/api/v1/orders")
      .set("Cookie", fixture.customers[0].cookie)
      .send({ shippingAddressId: address.id })
      .expect(201);

    expect(response.body).toMatchObject({
      orderNumber: expect.stringMatching(/^ORD-/),
      status: "PENDING",
      subtotal: "2.5",
      shippingTotal: "0",
      taxTotal: "0",
      grandTotal: "2.5",
      currencyCode: "USD",
      shippingRecipientName: "Cart Customer",
      shippingLine1: "1 Main Street",
    });
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      productId: fixture.productIds[0],
      productName: "Cart integration product 0",
      sku: expect.stringMatching(/^CART-PG-/),
      unitPrice: "1.25",
      quantity: 2,
      lineTotal: "2.5",
    });

    const persistedOrder = await prisma.order.findUnique({
      where: { id: response.body.id },
      include: { items: true },
    });
    expect(persistedOrder?.items[0]).toMatchObject({
      productName: "Cart integration product 0",
      unitPrice: new Prisma.Decimal("1.25"),
      quantity: 2,
      lineTotal: new Prisma.Decimal("2.50"),
    });

    const convertedCart = await prisma.cart.findFirst({
      where: { userId: fixture.customers[0].id, status: "CONVERTED" },
      include: { items: true },
    });
    expect(convertedCart?.items).toEqual([]);
    await request(app.getHttpServer())
      .get("/api/v1/cart")
      .set("Cookie", fixture.customers[0].cookie)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual({ id: null, items: [], totals: [] }));
  });

  it("keeps addresses and orders private to their customer", async () => {
    await request(app.getHttpServer()).get("/api/v1/addresses").expect(401);
    await request(app.getHttpServer()).get("/api/v1/orders").expect(401);

    const address = await addAddress(fixture.customers[0]);
    const primaryAddresses = await request(app.getHttpServer())
      .get("/api/v1/addresses")
      .set("Cookie", fixture.customers[0].cookie)
      .expect(200);
    const secondaryAddresses = await request(app.getHttpServer())
      .get("/api/v1/addresses")
      .set("Cookie", fixture.customers[1].cookie)
      .expect(200);
    expect(primaryAddresses.body).toHaveLength(1);
    expect(secondaryAddresses.body).toEqual([]);

    await request(app.getHttpServer())
      .post("/api/v1/orders")
      .set("Cookie", fixture.customers[1].cookie)
      .send({ shippingAddressId: address.id })
      .expect(404);

    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Cookie", fixture.customers[0].cookie)
      .send({ productId: fixture.productIds[0], quantity: 1 })
      .expect(201);
    const order = await request(app.getHttpServer())
      .post("/api/v1/orders")
      .set("Cookie", fixture.customers[0].cookie)
      .send({ shippingAddressId: address.id })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.body.id}`)
      .set("Cookie", fixture.customers[1].cookie)
      .expect(404);
    const foreignHistory = await request(app.getHttpServer())
      .get("/api/v1/orders")
      .set("Cookie", fixture.customers[1].cookie)
      .expect(200);
    expect(foreignHistory.body).toMatchObject({ data: [], total: 0 });
  });

  it("rolls back order creation and preserves the cart if clearing fails", async () => {
    const address = await addAddress(fixture.customers[0]);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Cookie", fixture.customers[0].cookie)
      .send({ productId: fixture.productIds[0], quantity: 2 })
      .expect(201);

    const originalTransaction = prisma.$transaction.bind(prisma);
    const transactionProxy = new Proxy(prisma, {
      get(target, property) {
        if (property !== "$transaction") {
          const value = Reflect.get(target, property, target) as unknown;
          return typeof value === "function" ? value.bind(target) : value;
        }

        return (
          callback: (transaction: Prisma.TransactionClient) => Promise<unknown>,
          options: { isolationLevel: Prisma.TransactionIsolationLevel },
        ) =>
          originalTransaction(
            async (transaction) => {
              const interceptedTransaction = new Proxy(transaction, {
                get(transactionTarget, transactionProperty) {
                  if (transactionProperty !== "cartItem") {
                    return Reflect.get(
                      transactionTarget,
                      transactionProperty,
                      transactionTarget,
                    ) as unknown;
                  }

                  const delegate = Reflect.get(
                    transactionTarget,
                    "cartItem",
                    transactionTarget,
                  ) as object;
                  return new Proxy(delegate, {
                    get(delegateTarget, method) {
                      const value = Reflect.get(
                        delegateTarget,
                        method,
                        delegateTarget,
                      ) as unknown;
                      if (method !== "deleteMany" || typeof value !== "function") {
                        return typeof value === "function"
                          ? value.bind(delegateTarget)
                          : value;
                      }

                      return async (...args: unknown[]) => {
                        await Reflect.apply(value, delegateTarget, args);
                        throw new Error("Injected cart clear failure.");
                      };
                    },
                  });
                },
              });
              return callback(interceptedTransaction);
            },
            options,
          );
      },
    });
    const orders = new OrdersService(
      transactionProxy as PrismaService,
      new CustomerMutationQueue(),
    );

    await expect(
      orders.placeOrder(fixture.customers[0].id, {
        shippingAddressId: address.id,
      }),
    ).rejects.toThrow("Injected cart clear failure.");

    expect(
      await prisma.order.count({ where: { userId: fixture.customers[0].id } }),
    ).toBe(0);
    const activeCart = await prisma.cart.findFirst({
      where: { userId: fixture.customers[0].id, status: "ACTIVE" },
      include: { items: true },
    });
    expect(activeCart?.items).toHaveLength(1);
    expect(activeCart?.items[0].quantity).toBe(2);
  });

  it("observes a real PostgreSQL serialization failure and CartService retry", async () => {
    const originalTransaction = prisma.$transaction.bind(prisma);
    const customerId = fixture.customers[0].id;
    let injectedConcurrentCart = false;
    let transactionAttempts = 0;
    let firstAttemptError: unknown;

    const transactionProxy = new Proxy(prisma, {
      get(target, property) {
        if (property !== "$transaction") {
          const value = Reflect.get(target, property, target) as unknown;
          return typeof value === "function" ? value.bind(target) : value;
        }

        return async (
          callback: (transaction: Prisma.TransactionClient) => Promise<unknown>,
        ) => {
          transactionAttempts += 1;
          try {
            return await originalTransaction(
              async (transaction) => {
                const interceptedTransaction = new Proxy(transaction, {
                  get(transactionTarget, transactionProperty) {
                    if (transactionProperty !== "cart") {
                      return Reflect.get(
                        transactionTarget,
                        transactionProperty,
                        transactionTarget,
                      ) as unknown;
                    }

                    const cartDelegate = Reflect.get(
                      transactionTarget,
                      "cart",
                      transactionTarget,
                    ) as object;
                    return new Proxy(cartDelegate, {
                      get(delegate, method) {
                        const value = Reflect.get(
                          delegate,
                          method,
                          delegate,
                        ) as unknown;
                        if (
                          method !== "findFirst" ||
                          typeof value !== "function"
                        ) {
                          return typeof value === "function"
                            ? value.bind(delegate)
                            : value;
                        }

                        return async (...args: unknown[]) => {
                          const result = await Reflect.apply(value, delegate, args);
                          const query = args[0] as
                            | { where?: { userId?: string; status?: string } }
                            | undefined;
                          if (
                            !injectedConcurrentCart &&
                            query?.where?.userId === customerId &&
                            query.where.status === "ACTIVE"
                          ) {
                            injectedConcurrentCart = true;
                            await originalTransaction(
                              async (concurrentTransaction) => {
                                await concurrentTransaction.cart.findFirst({
                                  where: {
                                    userId: customerId,
                                    status: "ACTIVE",
                                  },
                                  select: { id: true },
                                });
                                await concurrentTransaction.cart.create({
                                  data: { userId: customerId },
                                  select: { id: true },
                                });
                              },
                              {
                                isolationLevel:
                                  Prisma.TransactionIsolationLevel.Serializable,
                              },
                            );
                          }
                          return result;
                        };
                      },
                    });
                  },
                });

                return callback(interceptedTransaction);
              },
              {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
              },
            );
          } catch (error) {
            if (transactionAttempts === 1) {
              firstAttemptError = error;
            }
            throw error;
          }
        };
      },
    });

    const instrumentedService = new CartService(
      transactionProxy as PrismaService,
      new CustomerMutationQueue(),
    );
    const response = await instrumentedService.addItem(customerId, {
      productId: fixture.productIds[0],
      quantity: 1,
    } satisfies AddCartItemDto);

    expect(injectedConcurrentCart).toBe(true);
    expect(transactionAttempts).toBe(2);
    expect(firstAttemptError).toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    expect(firstAttemptError).toMatchObject({ code: "P2034" });
    expect(response.items).toHaveLength(1);

    const carts = await prisma.cart.findMany({
      where: { userId: customerId, status: "ACTIVE" },
      include: { items: true },
    });
    expect(carts).toHaveLength(1);
    expect(carts[0].items).toHaveLength(1);
    expect(carts[0].items[0].productId).toBe(fixture.productIds[0]);
    expect(carts[0].items[0].quantity).toBe(1);
  });

  it("gets a genuine P2034 when overlapping SERIALIZABLE transactions update one customer", async () => {
    let arrivals = 0;
    let releaseBarrier!: () => void;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });

    const updateCustomer = (firstName: string) =>
      prisma.$transaction(
        async (transaction) => {
          const customer = await transaction.user.findUnique({
            where: { id: fixture.customers[0].id },
            select: { id: true, firstName: true },
          });
          expect(customer).not.toBeNull();
          arrivals += 1;
          if (arrivals === 2) {
            releaseBarrier();
          }
          await barrier;
          return transaction.user.update({
            where: { id: fixture.customers[0].id },
            data: { firstName },
            select: { id: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    const results = await Promise.allSettled([
      updateCustomer("Concurrent A"),
      updateCustomer("Concurrent B"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      1,
    );
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected?.reason).toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    expect(rejected?.reason.code).toBe("P2034");

    const finalCustomer = await prisma.user.findUnique({
      where: { id: fixture.customers[0].id },
      select: { firstName: true },
    });
    expect(["Concurrent A", "Concurrent B"]).toContain(finalCustomer?.firstName);
  });

  async function createFixture(ids: FixtureIds): Promise<CartFixture> {
    const customerRole = await prisma.role.findUnique({
      where: { code: "CUSTOMER" },
    });
    if (!customerRole) {
      throw new Error(
        "PostgreSQL cart tests require the pre-provisioned CUSTOMER role.",
      );
    }
    const runId = randomUUID();
    const customers: CustomerFixture[] = [];

    for (const label of ["primary", "secondary"]) {
      const user = await prisma.user.create({
        data: {
          email: `cart-pg-${runId}-${label}@example.test`,
          passwordHash: "integration-test-only",
          firstName: "Cart",
          lastName: label,
          roles: {
            create: { role: { connect: { id: customerRole.id } } },
          },
        },
        select: { id: true },
      });
      ids.userIds.push(user.id);

      const { token, session } = await sessions.create(user.id);
      ids.sessionIds.push(session.id);
      customers.push({
        id: user.id,
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      });
    }

    const category = await prisma.category.create({
      data: {
        name: `Cart integration ${runId}`,
        slug: `cart-pg-${runId}`,
      },
      select: { id: true },
    });
    ids.categoryId = category.id;

    for (let index = 0; index < CART_CONCURRENCY; index += 1) {
      const product = await prisma.product.create({
        data: {
          categoryId: category.id,
          name: `Cart integration product ${index}`,
          slug: `cart-pg-${runId}-${index}`,
          sku: `CART-PG-${runId}-${index}`,
          description: "Isolated PostgreSQL cart integration fixture.",
          price: new Prisma.Decimal("1.25"),
          currencyCode: "USD",
          isPublished: true,
        },
        select: { id: true },
      });
      ids.productIds.push(product.id);
    }

    return {
      ...ids,
      customers: customers as [CustomerFixture, CustomerFixture],
      categoryId: category.id,
    };
  }

  async function addAddress(customer: CustomerFixture) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/addresses")
      .set("Cookie", customer.cookie)
      .send({
        label: "Home",
        recipientName: "Cart Customer",
        phone: "555-0100",
        line1: "1 Main Street",
        city: "Exampleville",
        region: "CA",
        postalCode: "90210",
        countryCode: "US",
      })
      .expect(201);
    return response.body as { id: string };
  }

  async function cleanupFixture(ids: FixtureIds): Promise<void> {
    if (ids.userIds.length > 0) {
      const orders = await prisma.order.findMany({
        where: { userId: { in: ids.userIds } },
        select: { id: true },
      });
      const orderIds = orders.map(({ id }) => id);
      if (orderIds.length > 0) {
        await prisma.orderItem.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await prisma.order.deleteMany({
          where: { id: { in: orderIds } },
        });
      }

      const carts = await prisma.cart.findMany({
        where: { userId: { in: ids.userIds } },
        select: { id: true },
      });
      const cartIds = carts.map(({ id }) => id);

      if (cartIds.length > 0) {
        await prisma.cartItem.deleteMany({
          where: { cartId: { in: cartIds } },
        });
      }
      await prisma.cart.deleteMany({ where: { userId: { in: ids.userIds } } });
    }
    if (ids.sessionIds.length > 0) {
      await prisma.session.deleteMany({
        where: { id: { in: ids.sessionIds } },
      });
    }
    if (ids.userIds.length > 0) {
      await prisma.userRole.deleteMany({
        where: { userId: { in: ids.userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: ids.userIds } } });
    }
    if (ids.productIds.length > 0) {
      await prisma.product.deleteMany({
        where: { id: { in: ids.productIds } },
      });
    }
    if (ids.categoryId) {
      await prisma.category.deleteMany({
        where: { id: ids.categoryId },
      });
    }
  }
});
