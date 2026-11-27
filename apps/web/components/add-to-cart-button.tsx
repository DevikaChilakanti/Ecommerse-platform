"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, apiPost } from "@/lib/api";
import type { CartResponse } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";

export function AddToCartButton({ productId }: { productId: string }) {
  const { user, isLoading, sessionError, refreshSession } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addItem() {
    setIsAdding(true);
    setMessage(null);
    setError(null);
    try {
      await apiPost<CartResponse>("/cart/items", { productId, quantity: 1 });
      setMessage("Added to your cart.");
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        await refreshSession();
        setError("Your session expired. Please sign in to add this item.");
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not add this product to your cart.",
        );
      }
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="space-y-2">
      {sessionError ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-red-700">
          <span role="alert">Could not verify your session.</span>
          <button
            type="button"
            onClick={() => void refreshSession()}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <button
          type="button"
          disabled
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white opacity-60"
        >
          Checking session…
        </button>
      ) : !user ? (
        <Link
          href="/login?next=%2Fcart"
          className="block rounded-lg border border-slate-300 px-4 py-2.5 text-center font-semibold text-slate-800 transition-colors hover:bg-slate-50"
        >
          Sign in to add to cart
        </Link>
      ) : !user.roles.includes("CUSTOMER") ? (
        <p className="text-sm text-slate-600">
          A customer account is required to add items.
        </p>
      ) : (
        <button
          type="button"
          disabled={isAdding}
          onClick={() => void addItem()}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAdding ? "Adding…" : "Add to cart"}
        </button>
      )}
      {message && (
        <p role="status" className="text-sm font-medium text-green-700">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
