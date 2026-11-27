"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, apiGet } from "@/lib/api";
import type { OrderResponse, PaginatedResponse } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";

const PAGE_SIZE = 20;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not load your orders.";
}

export default function OrdersPage() {
  const { user, isLoading: isLoadingSession, sessionError, refreshSession } =
    useAuth();
  const [result, setResult] =
    useState<PaginatedResponse<OrderResponse> | null>(null);
  const [ordersOwnerId, setOrdersOwnerId] = useState<string | null>(null);
  const [loadedPage, setLoadedPage] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const isCustomer = user?.roles.includes("CUSTOMER") ?? false;
  const hasOrdersForCurrentUser = user?.id === ordersOwnerId;

  useEffect(() => {
    if (isLoadingSession || sessionError || !isCustomer || !user) {
      return;
    }

    let active = true;
    apiGet<PaginatedResponse<OrderResponse>>(
      `/orders?page=${page}&limit=${PAGE_SIZE}`,
    )
      .then((response) => {
        if (active) {
          setResult(response);
          setOrdersOwnerId(user.id);
          setLoadedPage(page);
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
        setLoadedPage(page);
      });

    return () => {
      active = false;
    };
  }, [
    isCustomer,
    isLoadingSession,
    page,
    refreshSession,
    retryCount,
    sessionError,
    user,
  ]);

  function changePage(nextPage: number) {
    setError(null);
    setLoadedPage(null);
    setPage(nextPage);
  }

  function retry() {
    setError(null);
    setLoadedPage(null);
    setRetryCount((count) => count + 1);
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">
          Your account
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          My orders
        </h1>
      </header>

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
          <h2 className="text-xl font-semibold text-slate-900">
            Sign in to view your orders
          </h2>
          <Link
            href="/login?next=%2Forders"
            className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
          >
            Sign in
          </Link>
        </section>
      ) : !isCustomer ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700">
          Order history is available to customer accounts.
        </p>
      ) : error && !hasOrdersForCurrentUser ? (
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
      ) : loadedPage !== page || !hasOrdersForCurrentUser ? (
        <p role="status" className="py-12 text-center text-slate-600">
          Loading your orders…
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
      ) : !result || result.total === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            No orders yet
          </h2>
          <p className="mt-2 text-slate-600">
            Your completed checkouts will appear here.
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
          <div className="space-y-4">
            {result.data.map((order) => (
              <article
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <Link
                      href={`/orders/${encodeURIComponent(order.id)}`}
                      className="font-semibold text-slate-900 hover:text-sky-800"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="mt-1 text-sm text-slate-600">
                      Placed {new Date(order.placedAt).toLocaleDateString()}
                      {" · "}
                      {order.items.length}{" "}
                      {order.items.length === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-5 sm:justify-end">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium capitalize text-slate-700">
                      {order.status.toLowerCase()}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {order.grandTotal} {order.currencyCode}
                    </span>
                    <Link
                      href={`/orders/${encodeURIComponent(order.id)}`}
                      className="text-sm font-semibold text-sky-700 hover:text-sky-900"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {result.totalPages > 1 && (
            <nav
              aria-label="Order history pages"
              className="mt-6 flex items-center justify-between"
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {result.page} of {result.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= result.totalPages}
                onClick={() => changePage(page + 1)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
