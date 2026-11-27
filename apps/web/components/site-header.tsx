"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";

export function SiteHeader() {
  const { user, isLoading, sessionError, refreshSession, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const isCustomer = user?.roles.includes("CUSTOMER") ?? false;

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
    } catch (error: unknown) {
      setLogoutError(
        error instanceof Error ? error.message : "Could not sign out.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-slate-900"
          aria-label="Ecommerse home"
        >
          Ecommerse
        </Link>
        <nav
          aria-label="Main navigation"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-slate-600"
        >
          <Link href="/" className="transition-colors hover:text-slate-950">
            Home
          </Link>
          <Link
            href="/#products"
            className="transition-colors hover:text-slate-950"
          >
            Products
          </Link>
          {isLoading ? (
            <span role="status" className="text-slate-500">
              Checking session…
            </span>
          ) : sessionError ? (
            <div className="flex items-center gap-2">
              <span role="alert" className="text-red-700">
                Session unavailable
              </span>
              <button
                type="button"
                onClick={() => void refreshSession()}
                className="font-semibold text-sky-700 hover:text-sky-900"
              >
                Retry
              </button>
            </div>
          ) : user ? (
            <div className="flex flex-wrap items-center gap-3">
              {isCustomer && (
                <>
                  <Link
                    href="/cart"
                    className="transition-colors hover:text-slate-950"
                  >
                    Cart
                  </Link>
                  <Link
                    href="/addresses"
                    className="transition-colors hover:text-slate-950"
                  >
                    Addresses
                  </Link>
                  <Link
                    href="/orders"
                    className="transition-colors hover:text-slate-950"
                  >
                    My Orders
                  </Link>
                </>
              )}
              <span className="text-slate-700">
                Hi, {user.firstName}
              </span>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => void handleLogout()}
                className="font-semibold text-sky-700 hover:text-sky-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="transition-colors hover:text-slate-950"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="transition-colors hover:text-slate-950"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
      {logoutError && (
        <p
          role="alert"
          className="mx-auto max-w-7xl px-4 pb-3 text-right text-sm text-red-700 sm:px-6 lg:px-8"
        >
          {logoutError}
        </p>
      )}
    </header>
  );
}
