"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { apiGet } from "@/lib/api";
import type { PaginatedResponse, ProductResponse } from "@/lib/types";

export default function HomePage() {
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    apiGet<PaginatedResponse<ProductResponse>>("/products")
      .then((response) => {
        if (active) {
          setProducts(response.data);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load products.",
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
  }, []);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <section className="mb-10 rounded-3xl bg-slate-900 px-6 py-10 text-white sm:px-10 sm:py-14">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">
          Welcome to Ecommerse
        </p>
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
          Find something you&apos;ll love.
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-slate-300">
          Browse our latest products and discover something new.
        </p>
      </section>

      <section id="products" aria-labelledby="products-heading">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">
            Explore
          </p>
          <h2
            id="products-heading"
            className="mt-1 text-2xl font-bold tracking-tight text-slate-900"
          >
            Products
          </h2>
        </div>

        {loading ? (
          <p role="status" className="py-12 text-center text-slate-600">
            Loading products…
          </p>
        ) : error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
          >
            {error}
          </p>
        ) : products.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            No products are available right now. Please check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
