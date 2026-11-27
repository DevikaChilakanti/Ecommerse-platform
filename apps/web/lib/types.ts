export interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
}

export interface ProductImageResponse {
  id: string;
  url: string;
  altText: string | null;
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
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type RoleCode = "CUSTOMER" | "ADMIN";

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleCode[];
  createdAt: string;
}

export interface CartItemResponse {
  id: string;
  productId: string;
  name: string;
  slug: string;
  quantity: number;
  unitPrice: string;
  currencyCode: string;
  lineTotal: string;
  isAvailable: boolean;
}

export interface CartTotalResponse {
  currencyCode: string;
  subtotal: string;
}

export interface CartResponse {
  id: string | null;
  items: CartItemResponse[];
  totals: CartTotalResponse[];
}

export interface AddressResponse {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  countryCode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemResponse {
  id: string;
  productId: string | null;
  productName: string;
  sku: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface OrderResponse {
  id: string;
  orderNumber: string;
  shippingAddressId: string | null;
  status: string;
  subtotal: string;
  shippingTotal: string;
  taxTotal: string;
  grandTotal: string;
  currencyCode: string;
  shippingRecipientName: string;
  shippingPhone: string;
  shippingLine1: string;
  shippingLine2: string | null;
  shippingCity: string;
  shippingRegion: string | null;
  shippingPostalCode: string;
  shippingCountryCode: string;
  placedAt: string;
  createdAt: string;
  items: OrderItemResponse[];
}
