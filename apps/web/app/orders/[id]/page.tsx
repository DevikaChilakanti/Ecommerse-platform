"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ApiError, apiGet } from "@/lib/api";
import type { OrderResponse } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "This order could not be found or you do not have access to it.";
  }
  if (error instanceof ApiError && error.status === 400) {
    return "The order link is invalid.";
  }
  return error instanceof Error ? error.message : "Could not load this order.";
}

export default function OrderDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 text-center text-slate-600 sm:px-6 lg:px-8">
          Loading order…
        </main>
      }
    >
      <OrderDetailContent />
    </Suspense>
  );
}

function OrderDetailContent() {
  const { id } = useParams<{ id: string }>();
  const justPlaced = useSearchParams().get("placed") === "1";
  const { user, isLoading: isLoadingSession, sessionError, refreshSession } =
    useAuth();
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loadedOrderKey, setLoadedOrderKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const isCustomer = user?.roles.includes("CUSTOMER") ?? false;
  const currentOrderKey = user ? `${user.id}:${id}` : null;
  const hasCurrentOrder = currentOrderKey === loadedOrderKey;

  useEffect(() => {
    if (isLoadingSession || sessionError || !isCustomer || !user) {
      return;
    }

    let active = true;
    apiGet<OrderResponse>(`/orders/${encodeURIComponent(id)}`)
      .then((result) => {
        if (active) {
          setOrder(result);
          setLoadedOrderKey(`${user.id}:${id}`);
          setError(null);
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
      });

    return () => {
      active = false;
    };
  }, [
    id,
    isCustomer,
    isLoadingSession,
    refreshSession,
    retryCount,
    sessionError,
    user,
  ]);

  function retry() {
    setError(null);
    setLoadedOrderKey(null);
    setRetryCount((count) => count + 1);
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
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
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Sign in to view this order
          </h1>
          <Link
            href={`/login?next=${encodeURIComponent(`/orders/${id}`)}`}
            className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
          >
            Sign in
          </Link>
        </section>
      ) : !isCustomer ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700">
          Order details are available to customer accounts.
        </p>
      ) : error && !hasCurrentOrder ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-3 font-semibold underline"
          >
            Try again
          </button>
        </div>
      ) : !hasCurrentOrder || !order ? (
        <p role="status" className="py-12 text-center text-slate-600">
          Loading order…
        </p>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-3 font-semibold underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {justPlaced && (
            <section
              role="status"
              className="mb-6 rounded-xl border border-green-200 bg-green-50 p-5 text-green-900"
            >
              <h1 className="text-xl font-semibold">Order placed successfully</h1>
              <p className="mt-1">
                Your order number is{" "}
                <span className="font-bold">{order.orderNumber}</span>.
              </p>
            </section>
          )}

          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">
                Order details
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                {order.orderNumber}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Placed {new Date(order.placedAt).toLocaleString()}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium capitalize text-slate-700">
              {order.status.toLowerCase()}
            </span>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  Items
                </h2>
                <div className="mt-4 divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {item.productName}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          SKU {item.sku} · {item.quantity} × {item.unitPrice}{" "}
                          {order.currencyCode}
                        </p>
                      </div>
                      <p className="font-semibold text-slate-900">
                        {item.lineTotal} {order.currencyCode}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  Delivery address
                </h2>
                <p className="mt-3 font-medium text-slate-900">
                  {order.shippingRecipientName}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {order.shippingPhone}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {order.shippingLine1}
                  {order.shippingLine2 && (
                    <>
                      <br />
                      {order.shippingLine2}
                    </>
                  )}
                  <br />
                  {order.shippingCity}
                  {order.shippingRegion ? `, ${order.shippingRegion}` : ""}{" "}
                  {order.shippingPostalCode}
                  <br />
                  {order.shippingCountryCode}
                </p>
              </div>
            </section>

            <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Order total
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3 text-slate-600">
                  <dt>Subtotal</dt>
                  <dd>
                    {order.subtotal} {order.currencyCode}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 text-slate-600">
                  <dt>Shipping</dt>
                  <dd>
                    {order.shippingTotal} {order.currencyCode}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 text-slate-600">
                  <dt>Tax</dt>
                  <dd>
                    {order.taxTotal} {order.currencyCode}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-3 font-semibold text-slate-900">
                  <dt>Total</dt>
                  <dd>
                    {order.grandTotal} {order.currencyCode}
                  </dd>
                </div>
              </dl>
              <Link
                href="/orders"
                className="mt-6 inline-flex font-semibold text-sky-700 hover:text-sky-900"
              >
                Back to my orders
              </Link>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
