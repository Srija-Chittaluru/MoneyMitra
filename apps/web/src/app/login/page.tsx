"use client";

import { Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PublicHeader } from "@/components/shell/PublicHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/AuthContext";
import { ApiError } from "@/lib/api-client";

function LoginForm() {
  const { login, status } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const destination = searchParams.get("next") ?? "/dashboard";

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(destination);
    }
  }, [status, destination, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setApiError(null);

    if (!email.trim() || !password) {
      setFieldError("Enter your email and password.");
      return;
    }
    setFieldError(null);

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      router.push(destination);
    } catch (error) {
      setApiError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-h1 mb-1">Log in</h1>
      <p className="mb-6 text-sm text-muted">Welcome back to MoneyMitra.</p>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          id="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Input
          id="password"
          type="password"
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {(fieldError || apiError) && (
          <p className="text-sm text-error">{fieldError ?? apiError}</p>
        )}
        <Button type="submit" variant="primary" className="mt-2" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-link">
          Sign up
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center p-4">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
