import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { runSerializableTransaction } from "../prisma/serializable-transaction";
import { CustomerMutationQueue } from "./customer-mutation-queue.service";
import { AddCartItemDto, UpdateCartItemDto } from "./dto/cart-item.dto";
import {
  CartItemResponse,
  CartResponse,
  CartTotalResponse,
} from "./cart.types";

const CART_SELECT = {
  id: true,
  items: {
    select: {
      id: true,
      productId: true,
      quantity: true,
      product: {
        select: {
          name: true,
          slug: true,
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
} satisfies Prisma.CartSelect;

type CartRecord = Prisma.CartGetPayload<{ select: typeof CART_SELECT }>;
type CartTransaction = Prisma.TransactionClient;

const MAX_ITEM_QUANTITY = 99;

function isAvailable(
  product: CartRecord["items"][number]["product"],
): boolean {
  return (
    product.isPublished &&
    product.deletedAt === null &&
    product.category.isActive
  );
}

function cartResponse(cart: CartRecord | null): CartResponse {
  if (!cart) {
    return { id: null, items: [], totals: [] };
  }

  const subtotals = new Map<string, Prisma.Decimal>();
  const items: CartItemResponse[] = cart.items.map((item) => {
    const available = isAvailable(item.product);
    const lineTotal = item.product.price.mul(item.quantity);

    if (available) {
      const subtotal = subtotals.get(item.product.currencyCode) ?? new Prisma.Decimal(0);
      subtotals.set(item.product.currencyCode, subtotal.plus(lineTotal));
    }

    return {
      id: item.id,
      productId: item.productId,
      name: item.product.name,
      slug: item.product.slug,
      quantity: item.quantity,
      unitPrice: item.product.price.toString(),
      currencyCode: item.product.currencyCode,
      lineTotal: lineTotal.toString(),
      isAvailable: available,
    };
  });

  const totals: CartTotalResponse[] = Array.from(subtotals.entries())
    .sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB))
    .map(([currencyCode, subtotal]) => ({
      currencyCode,
      subtotal: subtotal.toString(),
    }));

  return { id: cart.id, items, totals };
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mutationQueue: CustomerMutationQueue,
  ) {}

  async getCart(userId: string): Promise<CartResponse> {
    const cart = await this.prisma.cart.findFirst({
      where: { userId, status: "ACTIVE" },
      select: CART_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return cartResponse(cart);
  }

  async addItem(userId: string, input: AddCartItemDto): Promise<CartResponse> {
    return this.runMutation(userId, async (transaction) => {
      const product = await transaction.product.findFirst({
        where: {
          id: input.productId,
          isPublished: true,
          deletedAt: null,
          category: { isActive: true },
        },
        select: { id: true },
      });
      if (!product) {
        throw new NotFoundException("Product not found.");
      }

      const cart = await this.findOrCreateCart(transaction, userId);
      const existing = await transaction.cartItem.findUnique({
        where: {
          cartId_productId: { cartId: cart.id, productId: input.productId },
        },
        select: { quantity: true },
      });
      if (existing && existing.quantity + input.quantity > MAX_ITEM_QUANTITY) {
        throw new BadRequestException(
          `A cart item cannot exceed ${MAX_ITEM_QUANTITY}.`,
        );
      }

      await transaction.cartItem.upsert({
        where: {
          cartId_productId: { cartId: cart.id, productId: input.productId },
        },
        create: {
          cartId: cart.id,
          productId: input.productId,
          quantity: input.quantity,
        },
        update: { quantity: { increment: input.quantity } },
        select: { id: true },
      });
      return this.loadCart(transaction, cart.id);
    });
  }

  async updateItem(
    userId: string,
    itemId: string,
    input: UpdateCartItemDto,
  ): Promise<CartResponse> {
    return this.runMutation(userId, async (transaction) => {
      const cart = await this.findActiveCart(transaction, userId);
      const item = await transaction.cartItem.findFirst({
        where: { id: itemId, cartId: cart.id },
        select: { id: true },
      });
      if (!item) {
        throw new NotFoundException("Cart item not found.");
      }

      await transaction.cartItem.update({
        where: { id: item.id },
        data: { quantity: input.quantity },
        select: { id: true },
      });
      return this.loadCart(transaction, cart.id);
    });
  }

  async removeItem(userId: string, itemId: string): Promise<CartResponse> {
    return this.runMutation(userId, async (transaction) => {
      const cart = await this.findActiveCart(transaction, userId);
      const item = await transaction.cartItem.findFirst({
        where: { id: itemId, cartId: cart.id },
        select: { id: true },
      });
      if (!item) {
        throw new NotFoundException("Cart item not found.");
      }

      await transaction.cartItem.delete({ where: { id: item.id } });
      return this.loadCart(transaction, cart.id);
    });
  }

  async clearCart(userId: string): Promise<CartResponse> {
    return this.runMutation(userId, async (transaction) => {
      const cart = await transaction.cart.findFirst({
        where: { userId, status: "ACTIVE" },
        select: { id: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      if (!cart) {
        return cartResponse(null);
      }

      await transaction.cartItem.deleteMany({ where: { cartId: cart.id } });
      return this.loadCart(transaction, cart.id);
    });
  }

  private runMutation<T>(
    userId: string,
    operation: (transaction: CartTransaction) => Promise<T>,
  ): Promise<T> {
    return this.mutationQueue.run(userId, () =>
      runSerializableTransaction(this.prisma, operation),
    );
  }

  private async findOrCreateCart(
    transaction: CartTransaction,
    userId: string,
  ): Promise<{ id: string }> {
    const existing = await transaction.cart.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { id: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return (
      existing ??
      transaction.cart.create({
        data: { userId },
        select: { id: true },
      })
    );
  }

  private async findActiveCart(
    transaction: CartTransaction,
    userId: string,
  ): Promise<{ id: string }> {
    const cart = await transaction.cart.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { id: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (!cart) {
      throw new NotFoundException("Cart not found.");
    }
    return cart;
  }

  private async loadCart(
    transaction: CartTransaction,
    cartId: string,
  ): Promise<CartResponse> {
    const cart = await transaction.cart.findUnique({
      where: { id: cartId },
      select: CART_SELECT,
    });
    return cartResponse(cart);
  }
}
