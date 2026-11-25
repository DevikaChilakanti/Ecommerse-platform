import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CartService } from "./cart.service";
import { CustomerMutationQueue } from "./customer-mutation-queue.service";

describe("CartService", () => {
  const cartRecord = {
    id: "cart-id",
    items: [
      {
        id: "item-usd",
        productId: "product-usd",
        quantity: 3,
        product: {
          name: "Widget",
          slug: "widget",
          price: new Prisma.Decimal("0.10"),
          currencyCode: "USD",
          isPublished: true,
          deletedAt: null,
          category: { isActive: true },
        },
      },
      {
        id: "item-eur",
        productId: "product-eur",
        quantity: 2,
        product: {
          name: "Gadget",
          slug: "gadget",
          price: new Prisma.Decimal("5.25"),
          currencyCode: "EUR",
          isPublished: true,
          deletedAt: null,
          category: { isActive: true },
        },
      },
      {
        id: "item-hidden",
        productId: "product-hidden",
        quantity: 2,
        product: {
          name: "Hidden",
          slug: "hidden",
          price: new Prisma.Decimal("100.00"),
          currencyCode: "USD",
          isPublished: false,
          deletedAt: null,
          category: { isActive: true },
        },
      },
    ],
  };

  const transaction = {
    cart: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    cartItem: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    product: { findFirst: jest.fn() },
  };
  const prisma = {
    cart: { findFirst: jest.fn() },
    $transaction: jest.fn(
      (operation: (tx: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    ),
  };
  const service = new CartService(
    prisma as unknown as PrismaService,
    new CustomerMutationQueue(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (operation: (tx: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    );
    transaction.cart.findUnique.mockResolvedValue(cartRecord);
    transaction.cart.findFirst.mockResolvedValue({ id: "cart-id" });
    transaction.cart.create.mockResolvedValue({ id: "cart-id" });
    transaction.cartItem.findUnique.mockResolvedValue(null);
    transaction.cartItem.findFirst.mockResolvedValue({ id: "item-id" });
    transaction.product.findFirst.mockResolvedValue({ id: "product-id" });
    transaction.cartItem.upsert.mockResolvedValue({ id: "item-id" });
  });

  it("returns an empty cart without creating one", async () => {
    prisma.cart.findFirst.mockResolvedValue(null);

    await expect(service.getCart("customer-id")).resolves.toEqual({
      id: null,
      items: [],
      totals: [],
    });
    expect(prisma.cart.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "customer-id", status: "ACTIVE" } }),
    );
    expect(transaction.cart.create).not.toHaveBeenCalled();
  });

  it("returns current prices, exact decimal line totals, currency-grouped totals, and availability", async () => {
    prisma.cart.findFirst.mockResolvedValue(cartRecord);

    const response = await service.getCart("customer-id");

    expect(response.totals).toEqual([
      { currencyCode: "EUR", subtotal: "10.5" },
      { currencyCode: "USD", subtotal: "0.3" },
    ]);
    expect(response.items[0]).toMatchObject({
      unitPrice: "0.1",
      lineTotal: "0.3",
      currencyCode: "USD",
      isAvailable: true,
    });
    expect(response.items[2]).toMatchObject({
      lineTotal: "200",
      isAvailable: false,
    });
    expect(response).not.toHaveProperty("userId");
    expect(response.items[0]).not.toHaveProperty("createdAt");
    expect(response.items[0]).not.toHaveProperty("isPublished");
  });

  it("adds a product with an atomic increment upsert and returns its updated cart", async () => {
    transaction.cartItem.findUnique.mockResolvedValue({ quantity: 4 });

    await service.addItem("trusted-customer-id", {
      productId: "product-id",
      quantity: 2,
    });

    expect(transaction.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "product-id",
          isPublished: true,
          deletedAt: null,
          category: { isActive: true },
        },
      }),
    );
    expect(transaction.cartItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cartId_productId: { cartId: "cart-id", productId: "product-id" } },
        update: { quantity: { increment: 2 } },
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  });

  it("rejects additions that would exceed the per-item limit", async () => {
    transaction.cartItem.findUnique.mockResolvedValue({ quantity: 98 });

    await expect(
      service.addItem("customer-id", { productId: "product-id", quantity: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.cartItem.upsert).not.toHaveBeenCalled();
  });

  it("rejects unavailable products before creating a cart", async () => {
    transaction.product.findFirst.mockResolvedValue(null);

    await expect(
      service.addItem("customer-id", { productId: "hidden-product", quantity: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.cart.create).not.toHaveBeenCalled();
  });

  it("returns 404 for an item outside the customer's cart", async () => {
    transaction.cartItem.findFirst.mockResolvedValue(null);

    await expect(
      service.updateItem("customer-id", "foreign-item-id", { quantity: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.cartItem.update).not.toHaveBeenCalled();
  });

  it("clears items while retaining the cart record", async () => {
    await service.clearCart("customer-id");

    expect(transaction.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: "cart-id" },
    });
    expect(transaction.cart.create).not.toHaveBeenCalled();
  });

  it("retries bounded P2034 serialization conflicts", async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, "random").mockReturnValue(0);
    try {
      prisma.$transaction
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError("Serialization conflict", {
            code: "P2034",
            clientVersion: "7.10.1",
          }),
        )
        .mockImplementationOnce(
          (operation: (tx: typeof transaction) => Promise<unknown>) =>
            operation(transaction),
        );
      transaction.cart.findFirst.mockResolvedValue(null);

      const result = service.clearCart("customer-id");
      await jest.advanceTimersByTimeAsync(25);

      await expect(result).resolves.toMatchObject({
        id: null,
        items: [],
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.restoreAllMocks();
      jest.useRealTimers();
    }
  });

  it("retries DriverAdapterError TransactionWriteConflict conflicts", async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, "random").mockReturnValue(0);
    try {
      prisma.$transaction
        .mockRejectedValueOnce(
          Object.assign(new Error("transaction write conflict"), {
            name: "DriverAdapterError",
            cause: { kind: "TransactionWriteConflict" },
          }),
        )
        .mockImplementationOnce(
          (operation: (tx: typeof transaction) => Promise<unknown>) =>
            operation(transaction),
        );
      transaction.cart.findFirst.mockResolvedValue(null);

      const result = service.clearCart("customer-id");
      await jest.advanceTimersByTimeAsync(25);

      await expect(result).resolves.toMatchObject({
        id: null,
        items: [],
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    } finally {
      jest.restoreAllMocks();
      jest.useRealTimers();
    }
  });

  it("retries DriverAdapterError PostgreSQL 40001 conflicts", async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, "random").mockReturnValue(0);
    try {
      prisma.$transaction
        .mockRejectedValueOnce(
          Object.assign(new Error("serialization failure"), {
            name: "DriverAdapterError",
            cause: { originalCode: "40001" },
          }),
        )
        .mockImplementationOnce(
          (operation: (tx: typeof transaction) => Promise<unknown>) =>
            operation(transaction),
        );
      transaction.cart.findFirst.mockResolvedValue(null);

      const result = service.clearCart("customer-id");
      await jest.advanceTimersByTimeAsync(25);

      await expect(result).resolves.toMatchObject({
        id: null,
        items: [],
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    } finally {
      jest.restoreAllMocks();
      jest.useRealTimers();
    }
  });

  it("uses bounded jittered delays for repeated P2034 conflicts", async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    try {
      const conflict = () =>
        new Prisma.PrismaClientKnownRequestError("Serialization conflict", {
          code: "P2034",
          clientVersion: "7.10.1",
        });
      prisma.$transaction
        .mockRejectedValueOnce(conflict())
        .mockRejectedValueOnce(conflict())
        .mockImplementationOnce(
          (operation: (tx: typeof transaction) => Promise<unknown>) =>
            operation(transaction),
        );

      const result = service.clearCart("customer-id");

      await jest.advanceTimersByTimeAsync(37);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(62);

      await expect(result).resolves.toMatchObject({
        id: "cart-id",
        items: expect.any(Array),
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    } finally {
      jest.restoreAllMocks();
      jest.useRealTimers();
    }
  });

  it("retries a serializable mutation at most three times and surfaces exhaustion", async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, "random").mockReturnValue(0);
    try {
      const conflict = () =>
        new Prisma.PrismaClientKnownRequestError("Serialization conflict", {
          code: "P2034",
          clientVersion: "7.10.1",
        });
      prisma.$transaction.mockRejectedValue(conflict());

      const rejection = expect(
        service.clearCart("customer-id"),
      ).rejects.toMatchObject({ code: "P2034" });

      await jest.advanceTimersByTimeAsync(25);
      await jest.advanceTimersByTimeAsync(50);
      await rejection;
      expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    } finally {
      jest.restoreAllMocks();
      jest.useRealTimers();
    }
  });

  it("does not retry non-P2034 errors", async () => {
    prisma.$transaction.mockRejectedValue(new Error("Unexpected failure"));

    await expect(
      service.clearCart("customer-id"),
    ).rejects.toThrow("Unexpected failure");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-serialization DriverAdapterError values", async () => {
    prisma.$transaction.mockRejectedValue(
      Object.assign(new Error("foreign key failure"), {
        name: "DriverAdapterError",
        cause: { kind: "ForeignKeyConstraintViolation" },
      }),
    );

    await expect(
      service.clearCart("customer-id"),
    ).rejects.toMatchObject({ name: "DriverAdapterError" });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
