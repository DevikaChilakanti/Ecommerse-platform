import Image from "next/image";
import Link from "next/link";
import type { ProductResponse } from "@/lib/types";
import { AddToCartButton } from "@/components/add-to-cart-button";

interface ProductCardProps {
  product: ProductResponse;
}

export function ProductCard({ product }: ProductCardProps) {
  const image = product.images[0];

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/products/${encodeURIComponent(product.slug)}`}
        className="block"
      >
        {image ? (
          <Image
            src={image.url}
            alt={image.altText || product.name}
            width={640}
            height={480}
            unoptimized
            className="aspect-[4/3] w-full bg-slate-100 object-cover"
          />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-sm text-slate-500">
            Image coming soon
          </div>
        )}
      </Link>
      <div className="space-y-3 p-4">
        <Link href={`/products/${encodeURIComponent(product.slug)}`}>
          <h2 className="line-clamp-2 font-semibold text-slate-900">
            {product.name}
          </h2>
          <p className="text-lg font-bold text-slate-900">
            {product.price} {product.currencyCode}
          </p>
          <p className="line-clamp-3 text-sm leading-6 text-slate-600">
            {product.description}
          </p>
        </Link>
        <AddToCartButton productId={product.id} />
      </div>
    </article>
  );
}
