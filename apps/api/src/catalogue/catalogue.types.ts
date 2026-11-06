export interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
}

export interface ProductResponse {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  price: string;
  compareAtPrice: string | null;
  currencyCode: string;
  category: CategoryResponse;
  images: ProductImageResponse[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminProductResponse extends ProductResponse {
  isPublished: boolean;
}

export interface ProductImageResponse {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
