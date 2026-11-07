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
