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
  placedAt: Date;
  createdAt: Date;
  items: OrderItemResponse[];
}

export interface PaginatedOrdersResponse {
  data: OrderResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
