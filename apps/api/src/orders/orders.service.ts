import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { CustomerMutationQueue } from "../cart/customer-mutation-queue.service";
import { PrismaService } from "../prisma/prisma.service";
import { runSerializableTransaction } from "../prisma/serializable-transaction";
import { ListQueryDto } from "../catalogue/dto/list-query.dto";
import {
  OrderResponse,
  PaginatedOrdersResponse,
} from "./order.types";
import { PlaceOrderDto } from "./dto/place-order.dto";

const CHECKOUT_CART_INCLUDE = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          currencyCode: true,
          isPublished: true,
          deletedAt: true,
          category: { select: { isActive: true } },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.CartInclude;

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  shippingAddressId: true,
  status: true,
  subtotal: true,
  shippingTotal: true,
  taxTotal: true,
  grandTotal: true,
  currencyCode: true,
  shippingRecipientName: true,
  shippingPhone: true,
  shippingLine1: true,
  shippingLine2: true,
  shippingCity: true,
  shippingRegion: true,
  shippingPostalCode: true,
  shippingCountryCode: true,
  placedAt: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      sku: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.OrderSelect;

type CheckoutCart = Prisma.CartGetPayload<{
  include: typeof CHECKOUT_CART_INCLUDE;
}>;
type OrderRecord = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;
type OrderTransaction = Prisma.TransactionClient;

function orderResponse(order: OrderRecord): OrderResponse {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    shippingAddressId: order.shippingAddressId,
    status: order.status,
    subtotal: order.subtotal.toString(),
    shippingTotal: order.shippingTotal.toString(),
    taxTotal: order.taxTotal.toString(),
    grandTotal: order.grandTotal.toString(),
    currencyCode: order.currencyCode,
    shippingRecipientName: order.shippingRecipientName,
    shippingPhone: order.shippingPhone,
    shippingLine1: order.shippingLine1,
    shippingLine2: order.shippingLine2,
    shippingCity: order.shippingCity,
    shippingRegion: order.shippingRegion,
    shippingPostalCode: order.shippingPostalCode,
    shippingCountryCode: order.shippingCountryCode,
    placedAt: order.placedAt,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      unitPrice: item.unitPrice.toString(),
      quantity: item.quantity,
      lineTotal: item.lineTotal.toString(),
    })),
  };
}

function isOrderable(cart: CheckoutCart): boolean {
  return cart.items.every(
    ({ product }) =>
      product.isPublished &&
      product.deletedAt === null &&
      product.category.isActive,
  );
}

function pagination<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): { data: T[]; page: number; limit: number; total: number; totalPages: number } {
  return { data, page, limit, total, totalPages: Math.ceil(total / limit) };
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mutationQueue: CustomerMutationQueue,
  ) {}

  placeOrder(userId: string, input: PlaceOrderDto): Promise<OrderResponse> {
    return this.mutationQueue.run(userId, () =>
      runSerializableTransaction(this.prisma, (transaction) =>
        this.createOrder(transaction, userId, input),
      ),
    );
  }

  async list(
    userId: string,
    query: ListQueryDto,
  ): Promise<PaginatedOrdersResponse> {
    const where: Prisma.OrderWhereInput = { userId };
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: ORDER_SELECT,
        orderBy: [{ placedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return pagination(
      orders.map(orderResponse),
      query.page,
      query.limit,
      total,
    );
  }

  async getById(userId: string, orderId: string): Promise<OrderResponse> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: ORDER_SELECT,
    });
    if (!order) {
      throw new NotFoundException("Order not found.");
    }
    return orderResponse(order);
  }

  private async createOrder(
    transaction: OrderTransaction,
    userId: string,
    input: PlaceOrderDto,
  ): Promise<OrderResponse> {
    const address = await transaction.address.findFirst({
      where: { id: input.shippingAddressId, userId },
      select: {
        id: true,
        recipientName: true,
        phone: true,
        line1: true,
        line2: true,
        city: true,
        region: true,
        postalCode: true,
        countryCode: true,
      },
    });
    if (!address) {
      throw new NotFoundException("Address not found.");
    }

    const cart = await transaction.cart.findFirst({
      where: { userId, status: "ACTIVE" },
      include: CHECKOUT_CART_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException("Cart is empty.");
    }
    if (!isOrderable(cart)) {
      throw new BadRequestException(
        "Cart contains a product that is no longer available.",
      );
    }

    const currencyCode = cart.items[0].product.currencyCode;
    if (
      cart.items.some((item) => item.product.currencyCode !== currencyCode)
    ) {
      throw new BadRequestException(
        "A cart cannot contain products in multiple currencies.",
      );
    }

    const subtotal = cart.items.reduce(
      (total, item) =>
        total.plus(item.product.price.mul(item.quantity)),
      new Prisma.Decimal(0),
    );
    const zero = new Prisma.Decimal(0);
    const order = await transaction.order.create({
      data: {
        orderNumber: `ORD-${randomUUID()}`,
        userId,
        shippingAddressId: address.id,
        subtotal,
        shippingTotal: zero,
        taxTotal: zero,
        grandTotal: subtotal,
        currencyCode,
        shippingRecipientName: address.recipientName,
        shippingPhone: address.phone,
        shippingLine1: address.line1,
        shippingLine2: address.line2,
        shippingCity: address.city,
        shippingRegion: address.region,
        shippingPostalCode: address.postalCode,
        shippingCountryCode: address.countryCode,
        items: {
          create: cart.items.map((item) => ({
            productId: item.product.id,
            productName: item.product.name,
            sku: item.product.sku,
            unitPrice: item.product.price,
            quantity: item.quantity,
            lineTotal: item.product.price.mul(item.quantity),
          })),
        },
      },
      select: ORDER_SELECT,
    });

    await transaction.cartItem.deleteMany({ where: { cartId: cart.id } });
    await transaction.cart.update({
      where: { id: cart.id },
      data: { status: "CONVERTED" },
      select: { id: true },
    });

    return orderResponse(order);
  }
}
