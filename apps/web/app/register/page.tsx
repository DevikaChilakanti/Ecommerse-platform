import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 items-start justify-center px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <AuthForm mode="register" />
    </main>
  );
}
