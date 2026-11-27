"use client";

import { Suspense } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiGet } from "@/lib/api";
import type { ProductResponse } from "@/lib/types";
import { AddToCartButton } from "@/components/add-to-cart-button";

export default function ProductDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 text-center text-slate-600 sm:px-6 lg:px-8">
          Loading product…
        </main>
      }
    >
      <ProductDetailContent />
    </Suspense>
  );
}

function ProductDetailContent() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    apiGet<ProductResponse>(`/products/${encodeURIComponent(slug)}`)
      .then((result) => {
        if (active) {
          setProduct(result);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof ApiError && requestError.status === 404
              ? "This product could not be found."
              : requestError instanceof Error
                ? requestError.message
                : "Could not load this product.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      {loading ? (
        <p role="status" className="py-12 text-center text-slate-600">
          Loading product…
        </p>
      ) : error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {error}
        </p>
      ) : product ? (
        <article className="grid gap-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 md:gap-12 md:p-8">
          <div>
            {product.images[0] ? (
              <Image
                src={product.images[0].url}
                alt={product.images[0].altText || product.name}
                width={1000}
                height={1000}
                unoptimized
                className="aspect-square w-full rounded-2xl bg-slate-100 object-cover"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                Image coming soon
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">
              {product.category.name}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {product.name}
            </h1>
            <p className="mt-5 text-2xl font-bold text-slate-900">
              {product.price} {product.currencyCode}
            </p>
            <p className="mt-6 whitespace-pre-line leading-7 text-slate-600">
              {product.description}
            </p>
            <div className="mt-8 max-w-sm">
              <AddToCartButton productId={product.id} />
            </div>
          </div>
        </article>
      ) : null}
    </main>
  );
}
