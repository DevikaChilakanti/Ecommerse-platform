"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type { AddressResponse } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";

interface AddressFormValues {
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
}

const EMPTY_ADDRESS: AddressFormValues = {
  label: "",
  recipientName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not load addresses.";
}

export default function AddressesPage() {
  const { user, isLoading: isLoadingSession, sessionError, refreshSession } =
    useAuth();
  const [addresses, setAddresses] = useState<AddressResponse[]>([]);
  const [addressesOwnerId, setAddressesOwnerId] = useState<string | null>(null);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [form, setForm] = useState<AddressFormValues>(EMPTY_ADDRESS);
  const isCustomer = user?.roles.includes("CUSTOMER") ?? false;
  const hasAddressesForCurrentUser = user?.id === addressesOwnerId;

  useEffect(() => {
    if (isLoadingSession || sessionError || !isCustomer || !user) {
      return;
    }

    let active = true;
    apiGet<AddressResponse[]>("/addresses")
      .then((result) => {
        if (active) {
          setAddresses(result);
          setAddressesOwnerId(user.id);
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
          setIsLoadingAddresses(false);
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

  function updateField(field: keyof AddressFormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);

    const requiredValues = [
      form.recipientName,
      form.phone,
      form.line1,
      form.city,
      form.postalCode,
      form.countryCode,
    ];
    if (requiredValues.some((value) => value.trim().length === 0)) {
      setFormError("Complete all required address fields.");
      return;
    }
    if (!/^[A-Za-z]{2}$/.test(form.countryCode.trim())) {
      setFormError("Enter a two-letter country code, such as US or CA.");
      return;
    }

    setIsSaving(true);
    try {
      const address = await apiPost<AddressResponse>("/addresses", {
        ...(form.label.trim() ? { label: form.label.trim() } : {}),
        recipientName: form.recipientName.trim(),
        phone: form.phone.trim(),
        line1: form.line1.trim(),
        ...(form.line2.trim() ? { line2: form.line2.trim() } : {}),
        city: form.city.trim(),
        ...(form.region.trim() ? { region: form.region.trim() } : {}),
        postalCode: form.postalCode.trim(),
        countryCode: form.countryCode.trim().toUpperCase(),
      });
      setAddresses((current) => [address, ...current]);
      setAddressesOwnerId(user?.id ?? null);
      setForm(EMPTY_ADDRESS);
      setSuccess("Address saved.");
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        setFormError("Your session expired. Please sign in again.");
        void refreshSession();
      } else {
        setFormError(errorMessage(requestError));
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">
          Your account
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Saved addresses
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
            Sign in to manage addresses
          </h2>
          <Link
            href="/login?next=%2Faddresses"
            className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
          >
            Sign in
          </Link>
        </section>
      ) : !isCustomer ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700">
          Address management is available to customer accounts.
        </p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Add an address
            </h2>
            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                Label <span className="font-normal text-slate-500">(optional)</span>
                <input
                  maxLength={100}
                  value={form.label}
                  onChange={(event) => updateField("label", event.target.value)}
                  placeholder="Home, work..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                Recipient name
                <input
                  required
                  minLength={1}
                  maxLength={200}
                  autoComplete="name"
                  value={form.recipientName}
                  onChange={(event) =>
                    updateField("recipientName", event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                Phone
                <input
                  required
                  minLength={1}
                  maxLength={50}
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                Address line 1
                <input
                  required
                  minLength={1}
                  maxLength={300}
                  autoComplete="address-line1"
                  value={form.line1}
                  onChange={(event) => updateField("line1", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                Address line 2{" "}
                <span className="font-normal text-slate-500">(optional)</span>
                <input
                  maxLength={300}
                  autoComplete="address-line2"
                  value={form.line2}
                  onChange={(event) => updateField("line2", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                  City
                  <input
                    required
                    minLength={1}
                    maxLength={100}
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={(event) => updateField("city", event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
                <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                  State / region{" "}
                  <span className="font-normal text-slate-500">(optional)</span>
                  <input
                    maxLength={100}
                    autoComplete="address-level1"
                    value={form.region}
                    onChange={(event) =>
                      updateField("region", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                  Postal code
                  <input
                    required
                    minLength={1}
                    maxLength={30}
                    autoComplete="postal-code"
                    value={form.postalCode}
                    onChange={(event) =>
                      updateField("postalCode", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
                <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                  Country code
                  <input
                    required
                    minLength={2}
                    maxLength={2}
                    pattern="[A-Za-z]{2}"
                    autoComplete="country"
                    value={form.countryCode}
                    onChange={(event) =>
                      updateField("countryCode", event.target.value)
                    }
                    placeholder="US"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 uppercase outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
              </div>

              {formError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {formError}
                </p>
              )}
              {success && (
                <p
                  role="status"
                  className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
                >
                  {success}
                </p>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving address…" : "Save address"}
              </button>
            </form>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900">
                Your addresses
              </h2>
              {loadError && (
                <button
                  type="button"
                  onClick={() => {
                    setLoadError(null);
                    setRetryCount((count) => count + 1);
                  }}
                  className="text-sm font-semibold text-sky-700 underline"
                >
                  Retry
                </button>
              )}
            </div>
            {isLoadingAddresses ||
            (!hasAddressesForCurrentUser && !loadError) ? (
              <p role="status" className="py-8 text-center text-slate-600">
                Loading addresses…
              </p>
            ) : loadError && !hasAddressesForCurrentUser ? (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
              >
                {loadError}
              </p>
            ) : !hasAddressesForCurrentUser || addresses.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
                You haven&apos;t saved any addresses yet.
              </p>
            ) : (
              <div className="space-y-4">
                {loadError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                  >
                    {loadError}
                  </p>
                )}
                {addresses.map((address) => (
                  <article
                    key={address.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    {address.label && (
                      <h3 className="font-semibold text-slate-900">
                        {address.label}
                      </h3>
                    )}
                    <p className={address.label ? "mt-2" : ""}>
                      {address.recipientName}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {address.phone}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
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
                      {address.postalCode}
                      <br />
                      {address.countryCode}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
