import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";
import { ListProductsQueryDto, ListQueryDto } from "./dto/list-query.dto";
import {
  CreateProductDto,
  UpdateProductDto,
} from "./dto/product.dto";
import {
  CreateProductImageDto,
  UpdateProductImageDto,
} from "./dto/product-image.dto";
import {
  CategoryResponse,
  AdminProductResponse,
  PaginatedResponse,
  ProductImageResponse,
  ProductResponse,
} from "./catalogue.types";

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  parentId: true,
  sortOrder: true,
} satisfies Prisma.CategorySelect;

const PRODUCT_INCLUDE = {
  category: { select: CATEGORY_SELECT },
  images: {
    select: { id: true, url: true, altText: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.ProductInclude;

type ProductRecord = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;
type CategoryRecord = Prisma.CategoryGetPayload<{
  select: typeof CATEGORY_SELECT;
}>;

const MAX_PRICE = new Prisma.Decimal("9999999999.99");

function categoryResponse(category: CategoryRecord): CategoryResponse {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    parentId: category.parentId,
    sortOrder: category.sortOrder,
  };
}

function productImageResponse(
  image: ProductRecord["images"][number],
): ProductImageResponse {
  return {
    id: image.id,
    url: image.url,
    altText: image.altText,
    sortOrder: image.sortOrder,
  };
}

function productResponse(product: ProductRecord): ProductResponse {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    price: product.price.toString(),
    compareAtPrice: product.compareAtPrice?.toString() ?? null,
    currencyCode: product.currencyCode,
    category: categoryResponse(product.category),
    images: product.images.map(productImageResponse),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function adminProductResponse(product: ProductRecord): AdminProductResponse {
  return {
    ...productResponse(product),
    isPublished: product.isPublished,
  };
}

function pagination<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedResponse<T> {
  return {
    data,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

function decimal(value: string): Prisma.Decimal {
  const parsed = new Prisma.Decimal(value);
  if (!parsed.isFinite() || parsed.isNegative() || parsed.greaterThan(MAX_PRICE)) {
    throw new BadRequestException("Price is outside the supported range.");
  }
  return parsed;
}

function uniqueConstraintFields(error: unknown): string[] {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = error.meta?.target;
    if (Array.isArray(target)) {
      return target.map(String);
    }
    return typeof target === "string" ? [target] : [];
  }
  return [];
}

function throwUniqueConflict(error: unknown): never {
  const fields = uniqueConstraintFields(error).join("_").toLowerCase();
  if (fields.includes("slug")) {
    throw new ConflictException("A resource with this slug already exists.");
  }
  if (fields.includes("sku")) {
    throw new ConflictException("A product with this SKU already exists.");
  }
  throw error;
}

function notFoundOrThrow<T>(value: T | null, message: string): T {
  if (!value) {
    throw new NotFoundException(message);
  }
  return value;
}

@Injectable()
export class CatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(
    query: ListQueryDto,
  ): Promise<PaginatedResponse<CategoryResponse>> {
    const where: Prisma.CategoryWhereInput = { isActive: true };
    const [categories, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        select: CATEGORY_SELECT,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    return pagination(categories.map(categoryResponse), query.page, query.limit, total);
  }

  async getCategoryBySlug(slug: string): Promise<CategoryResponse> {
    const category = await this.prisma.category.findFirst({
      where: { slug, isActive: true },
      select: CATEGORY_SELECT,
    });
    return categoryResponse(notFoundOrThrow(category, "Category not found."));
  }

  async listProducts(
    query: ListProductsQueryDto,
  ): Promise<PaginatedResponse<ProductResponse>> {
    const minPrice = query.minPrice ? decimal(query.minPrice) : undefined;
    const maxPrice = query.maxPrice ? decimal(query.maxPrice) : undefined;
    if (minPrice && maxPrice && minPrice.greaterThan(maxPrice)) {
      throw new BadRequestException("minPrice cannot exceed maxPrice.");
    }

    const where: Prisma.ProductWhereInput = {
      isPublished: true,
      deletedAt: null,
      category: { isActive: true },
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" } }
        : {}),
      ...(query.category ? { category: { slug: query.category, isActive: true } } : {}),
      ...(minPrice || maxPrice
        ? {
            price: {
              ...(minPrice ? { gte: minPrice } : {}),
              ...(maxPrice ? { lte: maxPrice } : {}),
            },
          }
        : {}),
    };

    const direction = query.sortOrder ?? (query.sortBy === "price" ? "asc" : "desc");
    const sortField =
      query.sortBy === "price"
        ? { price: direction }
        : query.sortBy === "name"
          ? { name: direction }
          : { createdAt: direction };
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: [sortField, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return pagination(
      products.map(productResponse),
      query.page,
      query.limit,
      total,
    );
  }

  async getProductBySlug(slug: string): Promise<ProductResponse> {
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        isPublished: true,
        deletedAt: null,
        category: { isActive: true },
      },
      include: PRODUCT_INCLUDE,
    });
    return productResponse(notFoundOrThrow(product, "Product not found."));
  }

  async createCategory(input: CreateCategoryDto): Promise<CategoryResponse> {
    if (input.parentId) {
      await this.requireActiveCategory(input.parentId);
    }

    try {
      const category = await this.prisma.category.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          parentId: input.parentId ?? null,
          sortOrder: input.sortOrder ?? 0,
        },
        select: CATEGORY_SELECT,
      });
      return categoryResponse(category);
    } catch (error) {
      throwUniqueConflict(error);
    }
  }

  async updateCategory(
    id: string,
    input: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    await this.requireCategory(id);
    if (input.parentId !== undefined && input.parentId !== null) {
      await this.assertNoParentCycle(id, input.parentId);
      await this.requireActiveCategory(input.parentId);
    }
    if (input.isActive === false) {
      await this.assertNoPublishedProducts(id);
    }

    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.slug !== undefined ? { slug: input.slug } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.parentId !== undefined
            ? { parentId: input.parentId }
            : {}),
          ...(input.sortOrder !== undefined
            ? { sortOrder: input.sortOrder }
            : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        select: CATEGORY_SELECT,
      });
      return categoryResponse(category);
    } catch (error) {
      throwUniqueConflict(error);
    }
  }

  async deactivateCategory(id: string): Promise<void> {
    await this.requireCategory(id);
    await this.assertNoPublishedProducts(id);
    await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
      select: { id: true },
    });
  }

  private async assertNoPublishedProducts(id: string): Promise<void> {
    const publishedProducts = await this.prisma.product.count({
      where: { categoryId: id, isPublished: true, deletedAt: null },
    });
    if (publishedProducts > 0) {
      throw new ConflictException(
        "A category with published products cannot be deactivated.",
      );
    }
  }

  async createProduct(input: CreateProductDto): Promise<AdminProductResponse> {
    await this.requireActiveCategory(input.categoryId);
    const price = decimal(input.price);
    const compareAtPrice = input.compareAtPrice
      ? decimal(input.compareAtPrice)
      : undefined;
    this.validateComparePrice(price, compareAtPrice);

    try {
      const product = await this.prisma.product.create({
        data: {
          name: input.name,
          slug: input.slug,
          sku: input.sku,
          description: input.description,
          categoryId: input.categoryId,
          price,
          compareAtPrice,
          currencyCode: input.currencyCode,
        },
        include: PRODUCT_INCLUDE,
      });
      return adminProductResponse(product);
    } catch (error) {
      throwUniqueConflict(error);
    }
  }

  async updateProduct(
    id: string,
    input: UpdateProductDto,
  ): Promise<AdminProductResponse> {
    const existing = notFoundOrThrow(await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, categoryId: true, price: true, compareAtPrice: true },
    }), "Product not found.");

    const categoryId = input.categoryId ?? existing.categoryId;
    if (
      input.categoryId !== undefined ||
      input.isPublished === true
    ) {
      await this.requireActiveCategory(categoryId);
    }
    const price = input.price !== undefined ? decimal(input.price) : existing.price;
    const compareAtPrice =
      input.compareAtPrice === null
        ? null
        : input.compareAtPrice !== undefined
          ? decimal(input.compareAtPrice)
          : existing.compareAtPrice;
    this.validateComparePrice(price, compareAtPrice ?? undefined);

    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.slug !== undefined ? { slug: input.slug } : {}),
          ...(input.sku !== undefined ? { sku: input.sku } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.categoryId !== undefined
            ? { categoryId: input.categoryId }
            : {}),
          ...(input.price !== undefined ? { price } : {}),
          ...(input.compareAtPrice !== undefined
            ? { compareAtPrice }
            : {}),
          ...(input.currencyCode !== undefined
            ? { currencyCode: input.currencyCode }
            : {}),
          ...(input.isPublished !== undefined
            ? { isPublished: input.isPublished }
            : {}),
        },
        include: PRODUCT_INCLUDE,
      });
      return adminProductResponse(product);
    } catch (error) {
      throwUniqueConflict(error);
    }
  }

  async deactivateProduct(id: string): Promise<void> {
    const result = await this.prisma.product.updateMany({
      where: { id, deletedAt: null },
      data: { isPublished: false, deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException("Product not found.");
    }
  }

  async addProductImage(
    productId: string,
    input: CreateProductImageDto,
  ): Promise<ProductImageResponse> {
    await this.requireActiveProduct(productId);
    return this.prisma.productImage.create({
      data: {
        productId,
        url: input.url,
        altText: input.altText,
        sortOrder: input.sortOrder ?? 0,
      },
      select: { id: true, url: true, altText: true, sortOrder: true },
    });
  }

  async updateProductImage(
    productId: string,
    imageId: string,
    input: UpdateProductImageDto,
  ): Promise<ProductImageResponse> {
    await this.requireImage(productId, imageId);
    return this.prisma.productImage.update({
      where: { id: imageId },
      data: {
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.altText !== undefined ? { altText: input.altText } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
      select: { id: true, url: true, altText: true, sortOrder: true },
    });
  }

  async deleteProductImage(productId: string, imageId: string): Promise<void> {
    await this.requireImage(productId, imageId);
    await this.prisma.productImage.delete({ where: { id: imageId } });
  }

  private async requireCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, parentId: true },
    });
    return notFoundOrThrow(category, "Category not found.");
  }

  private async requireActiveCategory(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
    return notFoundOrThrow(category, "Active category not found.");
  }

  private async requireActiveProduct(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    return notFoundOrThrow(product, "Product not found.");
  }

  private async requireImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
      select: { id: true },
    });
    return notFoundOrThrow(image, "Product image not found.");
  }

  private async assertNoParentCycle(
    categoryId: string,
    proposedParentId: string,
  ): Promise<void> {
    let currentId: string | null = proposedParentId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === categoryId || visited.has(currentId)) {
        throw new BadRequestException("Category parent would create a cycle.");
      }
      visited.add(currentId);
      const parent: { parentId: string | null } | null =
        await this.prisma.category.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });
      if (!parent) {
        throw new NotFoundException("Parent category not found.");
      }
      currentId = parent.parentId;
    }
  }

  private validateComparePrice(
    price: Prisma.Decimal,
    compareAtPrice?: Prisma.Decimal,
  ): void {
    if (compareAtPrice && !compareAtPrice.greaterThan(price)) {
      throw new BadRequestException("compareAtPrice must be greater than price.");
    }
  }
}
