import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request = require("supertest");
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { SessionService } from "../src/auth/session.service";
import { PrismaService } from "../src/prisma/prisma.service";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.FRONTEND_ORIGIN ??= "http://localhost:3000";

describe("Product catalogue endpoints", () => {
  let app: INestApplication;
  const category = {
    id: "category-id",
    name: "Widgets",
    slug: "widgets",
    description: null,
    parentId: null,
    sortOrder: 0,
    isActive: true,
  };
  const product = {
    id: "product-id",
    name: "Widget",
    slug: "widget",
    sku: "WIDGET-1",
    description: "A widget",
    price: { toString: () => "10.00" },
    compareAtPrice: null,
    currencyCode: "USD",
    category,
    images: [],
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  };

  const prismaMock = {
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
    category: {
      findFirst: jest.fn().mockResolvedValue(category),
      findUnique: jest.fn().mockResolvedValue(category),
      findMany: jest.fn().mockResolvedValue([category]),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockImplementation(async ({ data }) => ({
        ...category,
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ data }) => ({
        ...category,
        ...data,
      })),
    },
    product: {
      findMany: jest.fn().mockResolvedValue([product]),
      findFirst: jest.fn().mockResolvedValue(product),
      findUnique: jest.fn().mockResolvedValue(product),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue(product),
      update: jest.fn().mockResolvedValue(product),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    productImage: {
      create: jest.fn().mockResolvedValue({
        id: "image-id",
        url: "https://cdn.example.test/image.png",
        altText: null,
        sortOrder: 0,
      }),
      findFirst: jest.fn().mockResolvedValue({ id: "image-id" }),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const sessionMock = {
    findActive: jest.fn().mockImplementation(async (token: string) => ({
      id: "session-id",
      user: {
        id: "user-id",
        email: `${token}@example.test`,
        firstName: "Test",
        lastName: "User",
        createdAt: new Date(),
        isActive: true,
        roles: [{ role: { code: token === "admin" ? "ADMIN" : "CUSTOMER" } }],
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

  afterAll(async () => {
    await app.close();
  });

  it("serves active categories and published products to anonymous clients", async () => {
    const categories = await request(app.getHttpServer())
      .get("/api/v1/categories")
      .expect(200);
    expect(categories.body).toMatchObject({
      data: [{ id: "category-id", slug: "widgets" }],
      page: 1,
      limit: 20,
      total: 1,
    });
    expect(prismaMock.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );

    const products = await request(app.getHttpServer())
      .get("/api/v1/products?category=widgets&minPrice=1.25&sortBy=price")
      .expect(200);
    expect(products.body.data[0]).toMatchObject({
      id: "product-id",
      price: "10.00",
      category: { slug: "widgets" },
    });
    expect(products.body.data[0]).not.toHaveProperty("inventory");
    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublished: true,
          deletedAt: null,
          category: { slug: "widgets", isActive: true },
        }),
      }),
    );
  });

  it("returns 404 for unavailable public category and product details", async () => {
    prismaMock.category.findFirst.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .get("/api/v1/categories/hidden")
      .expect(404);

    prismaMock.product.findFirst.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .get("/api/v1/products/unpublished")
      .expect(404);
    expect(prismaMock.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: "unpublished",
          isPublished: true,
          deletedAt: null,
          category: { isActive: true },
        },
      }),
    );
  });

  it("returns a safe published product projection by slug", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/products/widget")
      .expect(200);
    expect(response.body).toMatchObject({
      id: "product-id",
      slug: "widget",
      price: "10.00",
      category: { slug: "widgets" },
      images: [],
    });
    expect(response.body).not.toHaveProperty("deletedAt");
    expect(response.body).not.toHaveProperty("inventory");
    expect(response.body).not.toHaveProperty("isPublished");
  });

  it("rejects invalid pagination, price, slug and non-HTTPS image URLs", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/products?page=0")
      .expect(400);
    await request(app.getHttpServer())
      .get("/api/v1/products?minPrice=1.234")
      .expect(400);
    await request(app.getHttpServer()).get("/api/v1/products/BadSlug").expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/admin/products/00000000-0000-4000-8000-000000000001/images")
      .set("Cookie", "ecommerse_session=admin")
      .send({ url: "http://cdn.example.test/image.png" })
      .expect(400);
  });

  it("denies anonymous and CUSTOMER clients while allowing ADMIN category management", async () => {
    const payload = {
      name: "New category",
      slug: "new-category",
      sortOrder: 1,
    };

    await request(app.getHttpServer())
      .post("/api/v1/admin/categories")
      .send(payload)
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/admin/categories")
      .set("Cookie", "ecommerse_session=customer")
      .send(payload)
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/v1/admin/categories")
      .set("Cookie", "ecommerse_session=admin")
      .send(payload)
      .expect(201)
      .expect((response) => {
        expect(response.body.slug).toBe("new-category");
      });
  });

  it("denies CUSTOMER access to product administration", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/admin/products/00000000-0000-4000-8000-000000000001")
      .set("Cookie", "ecommerse_session=customer")
      .send({ isPublished: true })
      .expect(403);
  });

  it("requires valid UUIDs on admin routes", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/admin/products/not-a-uuid")
      .set("Cookie", "ecommerse_session=admin")
      .send({ isPublished: true })
      .expect(400);
  });
});
