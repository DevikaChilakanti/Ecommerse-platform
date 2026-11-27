"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type {
  AddressResponse,
  CartResponse,
  OrderResponse,
} from "@/lib/types";
import { useAuth } from "@/components/auth-provider";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not load checkout.";
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isLoading: isLoadingSession, sessionError, refreshSession } =
    useAuth();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [addresses, setAddresses] = useState<AddressResponse[]>([]);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const isCustomer = user?.roles.includes("CUSTOMER") ?? false;
  const hasDataForCurrentUser = user?.id === dataOwnerId;

  useEffect(() => {
    if (isLoadingSession || sessionError || !isCustomer || !user) {
      return;
    }

    let active = true;
    Promise.all([
      apiGet<CartResponse>("/cart"),
      apiGet<AddressResponse[]>("/addresses"),
    ])
      .then(([cartResponse, addressResponse]) => {
        if (active) {
          setCart(cartResponse);
          setAddresses(addressResponse);
          setDataOwnerId(user.id);
          setSelectedAddressId((current) =>
            addressResponse.some((address) => address.id === current)
              ? current
              : (addressResponse[0]?.id ?? ""),
          );
          setLoadError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) {
          return;
        }
        if (requestError instanceof ApiError && requestError.status === 401) {
          setLoadError("Your session expired. Please sign in again.");
          void refreshSession();
        } else {
          setLoadError(errorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingData(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    isCustomer,
    isLoadingSession,
    refreshSession,
    retryCount,
    sessionError,
    user,
  ]);

  const currencies = cart
    ? Array.from(new Set(cart.items.map((item) => item.currencyCode)))
    : [];
  const hasUnavailableItems = cart?.items.some((item) => !item.isAvailable) ?? false;
  const hasMixedCurrencies = currencies.length > 1;
  const selectedAddress = addresses.find(
    (address) => address.id === selectedAddressId,
  );
  const canPlaceOrder =
    Boolean(cart && cart.items.length > 0) &&
    addresses.length > 0 &&
    Boolean(selectedAddressId) &&
    !hasUnavailableItems &&
    !hasMixedCurrencies &&
    !isSubmitting;

  async function placeOrder() {
    if (!selectedAddressId || !canPlaceOrder) {
      return;
    }
    setOrderError(null);
    setIsSubmitting(true);
    try {
      const order = await apiPost<OrderResponse>("/orders", {
        shippingAddressId: selectedAddressId,
      });
      router.replace(
        `/orders/${encodeURIComponent(order.id)}?placed=1`,
      );
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        setOrderError("Your session expired. Please sign in again.");
        void refreshSession();
      } else {
        setOrderError(errorMessage(requestError));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function retryLoading() {
    setLoadError(null);
    setIsLoadingData(true);
    setRetryCount((count) => count + 1);
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">
          Your cart
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Checkout
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
            Sign in to continue to checkout
          </h2>
          <Link
            href="/login?next=%2Fcheckout"
            className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
          >
            Sign in
          </Link>
        </section>
      ) : !isCustomer ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700">
          Checkout is available to customer accounts.
        </p>
      ) : loadError && !hasDataForCurrentUser ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          <p>{loadError}</p>
          <button
            type="button"
            onClick={retryLoading}
            className="mt-3 font-semibold underline"
          >
            Try again
          </button>
        </div>
      ) : isLoadingData || !hasDataForCurrentUser ? (
        <p role="status" className="py-12 text-center text-slate-600">
          Loading checkout…
        </p>
      ) : (
        <>
          {loadError && (
            <p
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {loadError}
            </p>
          )}
          {orderError && (
            <p
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {orderError}
            </p>
          )}

          {!cart || cart.items.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Your cart is empty
              </h2>
              <p className="mt-2 text-slate-600">
                Add products to your cart before checking out.
              </p>
              <Link
                href="/#products"
                className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
              >
                Browse products
              </Link>
            </section>
          ) : addresses.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Add a delivery address
              </h2>
              <p className="mt-2 text-slate-600">
                Save an address before placing your order.
              </p>
              <Link
                href="/addresses"
                className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
              >
                Manage addresses
              </Link>
            </section>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-xl font-semibold text-slate-900">
                    Delivery address
                  </h2>
                  <div className="mt-4 space-y-3">
                    {addresses.map((address) => (
                      <label
                        key={address.id}
                        className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${
                          selectedAddressId === address.id
                            ? "border-sky-600 bg-sky-50"
                            : "border-slate-200"
                        }`}
                      >
                        <input
                          type="radio"
                          name="shippingAddressId"
                          value={address.id}
                          checked={selectedAddressId === address.id}
                          onChange={() => setSelectedAddressId(address.id)}
                          className="mt-1 accent-sky-700"
                        />
                        <span className="text-sm leading-6 text-slate-700">
                          <span className="block font-semibold text-slate-900">
                            {address.label || address.recipientName}
                          </span>
                          {address.label && (
                            <span className="block">{address.recipientName}</span>
                          )}
                          {address.phone}
                          <br />
                          {address.line1}
                          {address.line2 && (
                            <>
                              <br />
                              {address.line2}
                            </>
                          )}
                          <br />
                          {address.city}
                          {address.region ? `, ${address.region}` : ""}{" "}
                          {address.postalCode}, {address.countryCode}
                        </span>
                      </label>
                    ))}
                  </div>
                  <Link
                    href="/addresses"
                    className="mt-4 inline-flex text-sm font-semibold text-sky-700 hover:text-sky-900"
                  >
                    Add or manage addresses
                  </Link>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-xl font-semibold text-slate-900">
                    Items in your order
                  </h2>
                  <div className="mt-4 divide-y divide-slate-100">
                    {cart.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col justify-between gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {item.name}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Quantity {item.quantity} · {item.unitPrice}{" "}
                            {item.currencyCode} each
                          </p>
                          {!item.isAvailable && (
                            <p className="mt-1 text-sm font-medium text-amber-800">
                              This product is no longer available.
                            </p>
                          )}
                        </div>
                        <p className="font-semibold text-slate-900">
                          {item.lineTotal} {item.currencyCode}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  Order summary
                </h2>
                {cart.totals.length > 0 ? (
                  <dl className="mt-4 space-y-3 text-sm">
                    {cart.totals.map((total) => (
                      <div
                        key={total.currencyCode}
                        className="flex justify-between gap-3 text-slate-700"
                      >
                        <dt>Subtotal ({total.currencyCode})</dt>
                        <dd>
                          {total.subtotal} {total.currencyCode}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-4 text-sm text-slate-600">
                    No available products to include in the subtotal.
                  </p>
                )}
                {hasUnavailableItems && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
                  >
                    Remove unavailable products from your cart before placing
                    the order.
                  </p>
                )}
                {hasMixedCurrencies && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
                  >
                    Your cart contains multiple currencies. A single order
                    cannot be placed until the cart uses one currency.
                  </p>
                )}
                {selectedAddress && (
                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    Delivering to {selectedAddress.recipientName} in{" "}
                    {selectedAddress.city}.
                  </p>
                )}
                <button
                  type="button"
                  disabled={!canPlaceOrder}
                  onClick={() => void placeOrder()}
                  className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Placing order…" : "Place order"}
                </button>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Shipping and tax are currently zero for this order.
                </p>
              </aside>
            </div>
          )}
        </>
      )}
    </main>
  );
}
