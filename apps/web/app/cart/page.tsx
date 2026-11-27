"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError, apiDelete, apiGet, apiPatch } from "@/lib/api";
import type { CartItemResponse, CartResponse } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not update your cart.";
}

export default function CartPage() {
  const { user, isLoading: isLoadingSession, sessionError, refreshSession } =
    useAuth();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [isLoadingCart, setIsLoadingCart] = useState(true);
  const [cartOwnerId, setCartOwnerId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isCustomer = user?.roles.includes("CUSTOMER") ?? false;
  const cartBelongsToCurrentUser = user?.id === cartOwnerId;
  const hasUnavailableItems = cart?.items.some((item) => !item.isAvailable) ?? false;
  const hasMixedCurrencies = cart
    ? new Set(cart.items.map((item) => item.currencyCode)).size > 1
    : false;
  const canCheckout =
    Boolean(cart && cart.items.length > 0) &&
    !hasUnavailableItems &&
    !hasMixedCurrencies;

  const loadCart = useCallback(async () => {
    setIsLoadingCart(true);
    setError(null);
    try {
      setCart(await apiGet<CartResponse>("/cart"));
      setCartOwnerId(user?.id ?? null);
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        setError("Your session expired. Please sign in again.");
        void refreshSession();
      } else {
        setError(errorMessage(requestError));
      }
    } finally {
      setIsLoadingCart(false);
    }
  }, [refreshSession, user]);

  useEffect(() => {
    if (isLoadingSession || sessionError || !isCustomer || !user) {
      return;
    }

    let active = true;
    apiGet<CartResponse>("/cart")
      .then((result) => {
        if (active) {
          setCart(result);
          setCartOwnerId(user.id);
          setError(null);
          setSuccess(null);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) {
          return;
        }
        if (requestError instanceof ApiError && requestError.status === 401) {
          setError("Your session expired. Please sign in again.");
          void refreshSession();
        } else {
          setError(errorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingCart(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    isCustomer,
    isLoadingSession,
    refreshSession,
    sessionError,
    user,
  ]);

  async function performMutation(
    action: string,
    request: () => Promise<CartResponse>,
    successMessage: string,
  ) {
    setPendingAction(action);
    setError(null);
    setSuccess(null);
    try {
      setCart(await request());
      setSuccess(successMessage);
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        setError("Your session expired. Please sign in again.");
        void refreshSession();
      } else {
        setError(errorMessage(requestError));
      }
    } finally {
      setPendingAction(null);
    }
  }

  function removeItem(item: CartItemResponse) {
    void performMutation(
      `remove-${item.id}`,
      () => apiDelete<CartResponse>(`/cart/items/${encodeURIComponent(item.id)}`),
      `${item.name} was removed from your cart.`,
    );
  }

  function changeQuantity(item: CartItemResponse, quantity: number) {
    if (quantity < 1) {
      removeItem(item);
      return;
    }
    void performMutation(
      `quantity-${item.id}`,
      () =>
        apiPatch<CartResponse>(
          `/cart/items/${encodeURIComponent(item.id)}`,
          { quantity },
        ),
      "Cart quantity updated.",
    );
  }

  function clearCart() {
    void performMutation(
      "clear",
      () => apiDelete<CartResponse>("/cart"),
      "Your cart has been cleared.",
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">
            Your account
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Shopping cart
          </h1>
          {user && (
            <p className="mt-2 text-sm text-slate-600">
              Cart for {user.firstName} {user.lastName}
            </p>
          )}
        </div>
        {cart && cart.items.length > 0 && isCustomer && (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={clearCart}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "clear" ? "Clearing…" : "Clear cart"}
          </button>
        )}
      </div>

      {success && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {success}
        </p>
      )}

      {isLoadingSession ? (
        <p role="status" className="py-12 text-center text-slate-600">
          Checking your session…
        </p>
      ) : sessionError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          <p>{sessionError}</p>
          <button
            type="button"
            onClick={() => void refreshSession()}
            className="mt-3 font-semibold underline"
          >
            Retry
          </button>
        </div>
      ) : !user ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Sign in to view your cart
          </h2>
          <p className="mt-2 text-slate-600">
            Your cart is saved to your customer account.
          </p>
          <Link
            href="/login?next=%2Fcart"
            className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
          >
            Sign in
          </Link>
        </section>
      ) : !isCustomer ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700">
          The shopping cart is available to customer accounts.
        </p>
      ) : isLoadingCart || (!cartBelongsToCurrentUser && !error) ? (
        <p role="status" className="py-12 text-center text-slate-600">
          Loading your cart…
        </p>
      ) : error && !cartBelongsToCurrentUser ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadCart()}
            className="mt-3 font-semibold underline"
          >
            Try again
          </button>
        </div>
      ) : !cartBelongsToCurrentUser || !cart || cart.items.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Your cart is empty
          </h2>
          <p className="mt-2 text-slate-600">
            Browse the catalogue and add products you like.
          </p>
          <Link
            href="/#products"
            className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
          >
            Browse products
          </Link>
        </section>
      ) : (
        <>
          {error && (
            <p
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section
              aria-label="Cart items"
              className="space-y-4"
            >
              {cart.items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <Link
                        href={`/products/${encodeURIComponent(item.slug)}`}
                        className="font-semibold text-slate-900 hover:text-sky-800"
                      >
                        {item.name}
                      </Link>
                      {item.isAvailable ? (
                        <p className="mt-1 text-sm text-slate-600">
                          {item.unitPrice} {item.currencyCode} each
                        </p>
                      ) : (
                        <p className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
                          Unavailable — remove this item before checkout
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end">
                      {item.isAvailable ? (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            aria-label={
                              item.quantity === 1
                                ? `Remove ${item.name}`
                                : `Decrease quantity of ${item.name}`
                            }
                            disabled={pendingAction !== null}
                            onClick={() =>
                              changeQuantity(item, item.quantity - 1)
                            }
                            className="h-9 w-9 rounded-lg border border-slate-300 text-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            −
                          </button>
                          <span
                            aria-label={`Quantity ${item.quantity}`}
                            className="min-w-6 text-center font-medium text-slate-900"
                          >
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${item.name}`}
                            disabled={
                              pendingAction !== null || item.quantity >= 99
                            }
                            onClick={() =>
                              changeQuantity(item, item.quantity + 1)
                            }
                            className="h-9 w-9 rounded-lg border border-slate-300 text-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-600">
                          Quantity: {item.quantity}
                        </span>
                      )}
                      <p className="min-w-28 text-right font-semibold text-slate-900">
                        {item.lineTotal} {item.currencyCode}
                      </p>
                      <button
                        type="button"
                        disabled={pendingAction !== null}
                        onClick={() => removeItem(item)}
                        className="text-sm font-semibold text-red-700 hover:text-red-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {pendingAction === `remove-${item.id}`
                          ? "Removing…"
                          : "Remove"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Cart summary
              </h2>
              {cart.totals.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {cart.totals.map((total) => (
                    <div
                      key={total.currencyCode}
                      className="space-y-2 border-b border-slate-100 pb-3 last:border-0"
                    >
                      <div className="flex justify-between gap-3 text-sm text-slate-600">
                        <span>Subtotal ({total.currencyCode})</span>
                        <span>
                          {total.subtotal} {total.currencyCode}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3 font-semibold text-slate-900">
                        <span>Cart total before shipping/tax</span>
                        <span>
                          {total.subtotal} {total.currencyCode}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  No available products to include in the total.
                </p>
              )}
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Totals are provided by the cart API and include available
                products only. Shipping and tax are not calculated here.
              </p>
              {hasMixedCurrencies && (
                <p className="mt-4 text-sm text-amber-800">
                  Checkout requires all cart items to use the same currency.
                </p>
              )}
              {canCheckout ? (
                pendingAction ? (
                  <button
                    type="button"
                    disabled
                    className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white opacity-50"
                  >
                    Updating cart…
                  </button>
                ) : (
                  <Link
                    href="/checkout"
                    className="mt-6 block rounded-lg bg-slate-900 px-4 py-3 text-center font-semibold text-white hover:bg-slate-700"
                  >
                    Proceed to checkout
                  </Link>
                )
              ) : (
                <p className="mt-6 text-sm text-slate-500">
                  {hasUnavailableItems
                    ? "Remove unavailable products to continue to checkout."
                    : "Use a single currency in your cart to continue to checkout."}
                </p>
              )}
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
