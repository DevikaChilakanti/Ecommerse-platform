import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { CustomerMutationQueue } from "../cart/customer-mutation-queue.service";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "./orders.service";

describe("OrdersService", () => {
  const address = {
    id: "address-id",
    recipientName: "Ada Customer",
    phone: "555-0100",
    line1: "1 Main Street",
    line2: null,
    city: "Exampleville",
    region: "CA",
    postalCode: "90210",
    countryCode: "US",
  };
  const product = {
    id: "product-id",
    name: "Widget",
    sku: "WIDGET-1",
    price: new Prisma.Decimal("0.10"),
    currencyCode: "USD",
    isPublished: true,
    deletedAt: null,
    category: { isActive: true },
  };
  const cartRecord = {
    id: "cart-id",
    items: [{ id: "cart-item-id", productId: product.id, quantity: 3, product }],
  };
  const orderRecord = {
    id: "order-id",
    orderNumber: "ORD-test",
    shippingAddressId: address.id,
    status: "PENDING" as const,
    subtotal: new Prisma.Decimal("0.30"),
    shippingTotal: new Prisma.Decimal(0),
    taxTotal: new Prisma.Decimal(0),
    grandTotal: new Prisma.Decimal("0.30"),
    currencyCode: "USD",
    shippingRecipientName: address.recipientName,
    shippingPhone: address.phone,
    shippingLine1: address.line1,
    shippingLine2: address.line2,
    shippingCity: address.city,
    shippingRegion: address.region,
    shippingPostalCode: address.postalCode,
    shippingCountryCode: address.countryCode,
    placedAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    items: [
      {
        id: "order-item-id",
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitPrice: product.price,
        quantity: 3,
        lineTotal: new Prisma.Decimal("0.30"),
      },
    ],
  };

  const transaction = {
    address: { findFirst: jest.fn() },
    cart: { findFirst: jest.fn(), update: jest.fn() },
    cartItem: { deleteMany: jest.fn() },
    order: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(
      (
        operation:
          | ((tx: typeof transaction) => Promise<unknown>)
          | Promise<unknown>[],
    ) =>
      Array.isArray(operation)
        ? Promise.all(operation)
        : operation(transaction),
    ),
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new CustomerMutationQueue(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.address.findFirst.mockResolvedValue(address);
    transaction.cart.findFirst.mockResolvedValue(cartRecord);
    transaction.cart.update.mockResolvedValue({ id: "cart-id" });
    transaction.cartItem.deleteMany.mockResolvedValue({ count: 1 });
    transaction.order.create.mockResolvedValue(orderRecord);
    prisma.order.findMany.mockResolvedValue([orderRecord]);
    prisma.order.count.mockResolvedValue(1);
    prisma.order.findFirst.mockResolvedValue(orderRecord);
  });

  it("creates an order with decimal totals and product and address snapshots", async () => {
    const result = await service.placeOrder("customer-id", {
      shippingAddressId: address.id,
    });

    expect(transaction.address.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: address.id, userId: "customer-id" },
      }),
    );
    expect(transaction.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: new Prisma.Decimal("0.30"),
          shippingTotal: new Prisma.Decimal(0),
          taxTotal: new Prisma.Decimal(0),
          grandTotal: new Prisma.Decimal("0.30"),
          shippingRecipientName: address.recipientName,
          shippingLine1: address.line1,
          items: {
            create: [
              expect.objectContaining({
                productName: "Widget",
                sku: "WIDGET-1",
                unitPrice: new Prisma.Decimal("0.10"),
                quantity: 3,
                lineTotal: new Prisma.Decimal("0.30"),
              }),
            ],
          },
        }),
      }),
    );
    expect(result.subtotal).toBe("0.3");
    expect(result.items[0]).toMatchObject({
      productName: "Widget",
      sku: "WIDGET-1",
      unitPrice: "0.1",
      quantity: 3,
      lineTotal: "0.3",
    });
    expect(transaction.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: "cart-id" },
    });
    expect(transaction.cart.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cart-id" },
        data: { status: "CONVERTED" },
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  });

  it("rejects an address not owned by the customer before changing the cart", async () => {
    transaction.address.findFirst.mockResolvedValue(null);

    await expect(
      service.placeOrder("customer-id", { shippingAddressId: address.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.cart.findFirst).not.toHaveBeenCalled();
    expect(transaction.order.create).not.toHaveBeenCalled();
  });

  it("rejects an empty cart", async () => {
    transaction.cart.findFirst.mockResolvedValue({ id: "cart-id", items: [] });

    await expect(
      service.placeOrder("customer-id", { shippingAddressId: address.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.order.create).not.toHaveBeenCalled();
    expect(transaction.cart.update).not.toHaveBeenCalled();
  });

  it("rejects products that are no longer available", async () => {
    transaction.cart.findFirst.mockResolvedValue({
      ...cartRecord,
      items: [
        {
          ...cartRecord.items[0],
          product: { ...product, isPublished: false },
        },
      ],
    });

    await expect(
      service.placeOrder("customer-id", { shippingAddressId: address.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.order.create).not.toHaveBeenCalled();
    expect(transaction.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a cart with multiple currencies", async () => {
    transaction.cart.findFirst.mockResolvedValue({
      ...cartRecord,
      items: [
        ...cartRecord.items,
        {
          ...cartRecord.items[0],
          id: "other-cart-item",
          product: { ...product, currencyCode: "EUR" },
        },
      ],
    });

    await expect(
      service.placeOrder("customer-id", { shippingAddressId: address.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.order.create).not.toHaveBeenCalled();
    expect(transaction.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  it("leaves cart conversion until after all order writes succeed", async () => {
    transaction.cartItem.deleteMany.mockRejectedValue(
      new Error("Cart clear failed."),
    );

    await expect(
      service.placeOrder("customer-id", { shippingAddressId: address.id }),
    ).rejects.toThrow("Cart clear failed.");
    expect(transaction.order.create).toHaveBeenCalled();
    expect(transaction.cart.update).not.toHaveBeenCalled();
  });

  it("paginates only the customer's orders and hides foreign order details", async () => {
    await expect(
      service.list("customer-id", { page: 2, limit: 5 }),
    ).resolves.toMatchObject({
      data: [{ id: "order-id" }],
      page: 2,
      limit: 5,
      total: 1,
      totalPages: 1,
    });
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "customer-id" },
        skip: 5,
        take: 5,
      }),
    );

    prisma.order.findFirst.mockResolvedValue(null);
    await expect(
      service.getById("another-customer", "order-id"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-id", userId: "another-customer" },
      }),
    );
  });
});
