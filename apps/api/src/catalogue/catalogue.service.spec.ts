import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CatalogueService } from "./catalogue.service";
import { ListProductsQueryDto } from "./dto/list-query.dto";

describe("CatalogueService", () => {
  const product = {
    id: "product-id",
    name: "Widget",
    slug: "widget",
    sku: "WIDGET-1",
    description: "A useful widget",
    price: new Prisma.Decimal("10.20"),
    compareAtPrice: new Prisma.Decimal("12.00"),
    currencyCode: "USD",
    isPublished: true,
    deletedAt: null,
    categoryId: "category-id",
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-02T00:00:00.000Z"),
    category: {
      id: "category-id",
      name: "Widgets",
      slug: "widgets",
      description: null,
      parentId: null,
      sortOrder: 0,
    },
    images: [
      {
        id: "image-id",
        url: "https://cdn.example.test/widget.png",
        altText: null,
        sortOrder: 0,
      },
    ],
  };

  const prisma = {
    $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
    category: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    productImage: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new CatalogueService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("filters public product queries and sorts with an ID tie-breaker", async () => {
    prisma.product.findMany.mockResolvedValue([product]);
    prisma.product.count.mockResolvedValue(1);
    const query = Object.assign(new ListProductsQueryDto(), {
      page: 2,
      limit: 10,
      search: " widget ",
      category: "widgets",
      minPrice: "9.50",
      maxPrice: "20",
      sortBy: "price" as const,
    });

    const result = await service.listProducts(query);
    const args = prisma.product.findMany.mock.calls[0][0];

    expect(args.where).toMatchObject({
      isPublished: true,
      deletedAt: null,
      category: { slug: "widgets", isActive: true },
      name: { contains: " widget ", mode: "insensitive" },
      price: {
        gte: new Prisma.Decimal("9.50"),
        lte: new Prisma.Decimal("20"),
      },
    });
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(args.orderBy).toEqual([{ price: "asc" }, { id: "asc" }]);
    expect(result.data[0].price).toBe("10.2");
    expect(result.data[0]).not.toHaveProperty("deletedAt");
    expect(result.data[0]).not.toHaveProperty("isPublished");
    expect(result.data[0]).not.toHaveProperty("inventory");
  });

  it("rejects inverted price filters without querying", async () => {
    const query = Object.assign(new ListProductsQueryDto(), {
      page: 1,
      limit: 20,
      minPrice: "20",
      maxPrice: "10",
    });

    await expect(service.listProducts(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it("rejects compare-at prices not greater than the product price", async () => {
    prisma.category.findFirst.mockResolvedValue({ id: "category-id" });

    await expect(
      service.createProduct({
        name: "Widget",
        slug: "widget",
        sku: "WIDGET-1",
        description: "Widget description",
        categoryId: "category-id",
        price: "20.00",
        compareAtPrice: "19.99",
        currencyCode: "USD",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it("maps duplicate product slug and SKU errors to HTTP 409", async () => {
    prisma.category.findFirst.mockResolvedValue({ id: "category-id" });
    prisma.product.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.10.1",
        meta: { target: ["sku"] },
      }),
    );

    await expect(
      service.createProduct({
        name: "Widget",
        slug: "widget",
        sku: "WIDGET-1",
        description: "Widget description",
        categoryId: "category-id",
        price: "20.00",
        currencyCode: "USD",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("maps duplicate slug constraint names to HTTP 409", async () => {
    prisma.category.findFirst.mockResolvedValue({ id: "category-id" });
    prisma.product.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.10.1",
        meta: { target: "Product_slug_key" },
      }),
    );

    await expect(
      service.createProduct({
        name: "Widget",
        slug: "widget",
        sku: "WIDGET-2",
        description: "Widget description",
        categoryId: "category-id",
        price: "20.00",
        currencyCode: "USD",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("prevents category parent cycles", async () => {
    prisma.category.findUnique
      .mockResolvedValueOnce({ id: "category-a", parentId: null })
      .mockResolvedValueOnce({ parentId: "category-a" });

    await expect(
      service.updateCategory("category-a", { parentId: "category-b" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it("blocks category deactivation while published products exist", async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: "category-id",
      parentId: null,
    });
    prisma.product.count.mockResolvedValue(1);

    await expect(service.deactivateCategory("category-id")).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it("also blocks deactivation through the category update endpoint", async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: "category-id",
      parentId: null,
    });
    prisma.product.count.mockResolvedValue(1);

    await expect(
      service.updateCategory("category-id", { isActive: false }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it("soft-deactivates products without deleting their history", async () => {
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    await service.deactivateProduct("product-id");

    expect(prisma.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "product-id", deletedAt: null },
        data: {
          isPublished: false,
          deletedAt: expect.any(Date),
        },
      }),
    );
  });

  it("rejects image updates when the image belongs to another product", async () => {
    prisma.productImage.findFirst.mockResolvedValue(null);

    await expect(
      service.updateProductImage("product-a", "image-b", {
        url: "https://cdn.example.test/image.png",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.productImage.update).not.toHaveBeenCalled();
  });
});
