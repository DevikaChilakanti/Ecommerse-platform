"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiPost } from "@/lib/api";
import type { UserProfile } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";

type AuthMode = "login" | "register";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { authenticate } = useAuth();
  const isRegister = mode === "register";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const profile = await apiPost<UserProfile>(
        isRegister ? "/auth/register" : "/auth/login",
        isRegister
          ? { firstName, lastName, email, password }
          : { email, password },
      );
      authenticate(profile);

      const next = new URLSearchParams(window.location.search).get("next");
      const destination =
        next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
          ? next
          : "/";
      router.replace(destination);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not complete your request.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">
          Customer account
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 leading-6 text-slate-600">
          {isRegister
            ? "Register to manage your cart and orders."
            : "Sign in to continue to your account and cart."}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {isRegister && (
          <>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              First name
              <input
                autoComplete="given-name"
                required
                minLength={1}
                maxLength={100}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Last name
              <input
                autoComplete="family-name"
                required
                minLength={1}
                maxLength={100}
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
              />
            </label>
          </>
        )}

        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            minLength={isRegister ? 12 : 1}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          />
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? isRegister
              ? "Creating account…"
              : "Signing in…"
            : isRegister
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        {isRegister ? "Already have an account?" : "New to Ecommerse?"}{" "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-semibold text-sky-700 hover:text-sky-900"
        >
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </section>
  );
}
