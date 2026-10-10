"use client";

import { Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Mail, Lock } from "lucide-react";
import { AuthBackdrop } from "@/components/auth/AuthBackdrop";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { AuthHero } from "@/components/auth/AuthHero";
import { AuthShowcase } from "@/components/auth/AuthShowcase";
import { Logo } from "@/components/Logo";
import { PublicHeader } from "@/components/shell/PublicHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/AuthContext";
import { ApiError } from "@/lib/api-client";

/**
 * Dark mode keeps the original split-screen design (photo showcase panel).
 * Light mode has no equivalent photography, so it gets a simpler centered
 * card instead. Both blocks below render from the SAME state/handlers in
 * this component — only one is ever visible (CSS `dark:`/`hidden`) — so
 * switching theme mid-form never loses what you've typed.
 */
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

  const fields = (idPrefix: string) => (
    <>
      <Input
        id={`${idPrefix}-email`}
        type="email"
        label="Email address"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        className="bg-field border-line"
      />
      <PasswordInput
        id={`${idPrefix}-password`}
        label="Password"
        placeholder="Your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
        className="bg-field border-line"
      />
      {(fieldError || apiError) && <p className="text-sm text-error">{fieldError ?? apiError}</p>}
      <Button type="submit" variant="primary" className="mt-2" disabled={submitting}>
        {submitting ? "Logging in…" : "Log in"}
      </Button>
    </>
  );

  // Light mode only: icon-prefixed fields and a pill-shaped lime CTA, matching
  // the brand panel's carousel. Kept separate from `fields()` so dark mode's
  // existing form is never touched.
  const lightFields = (idPrefix: string) => (
    <>
      <Input
        id={`${idPrefix}-email`}
        type="email"
        label="Email address"
        placeholder="you@example.com"
        icon={<Mail className="h-4 w-4" strokeWidth={1.75} />}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        className="h-12 rounded-xl bg-field border-line"
      />
      <PasswordInput
        id={`${idPrefix}-password`}
        label="Password"
        placeholder="Your password"
        icon={<Lock className="h-4 w-4" strokeWidth={1.75} />}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
        className="h-12 rounded-xl bg-field border-line"
      />
      {(fieldError || apiError) && <p className="text-sm text-error">{fieldError ?? apiError}</p>}
      <Button
        type="submit"
        variant="primary"
        className="mt-2 h-[52px] rounded-full bg-accent text-accent-foreground hover:opacity-90"
        disabled={submitting}
      >
        {submitting ? "Logging in…" : "Log in"}
      </Button>
    </>
  );

  return (
    <>
      {/* ---------- Dark mode: split-screen with photo showcase ---------- */}
      <div className="hidden w-full gap-3.5 dark:flex">
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto rounded-3xl border border-line bg-card px-6 py-8 sm:px-10 lg:basis-[520px] lg:flex-none lg:px-12">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" aria-label="Back to MoneyMitra home" className="inline-flex">
              <Logo height={32} />
            </Link>
            <ThemeToggle />
          </div>
          <div className="mx-auto my-auto flex w-full max-w-[420px] flex-col py-10">
            <h1 className="text-h1 mb-1">Welcome back</h1>
            <p className="mb-7 text-sm text-muted">Log in to your MoneyMitra workspace.</p>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              {fields("dark")}
            </form>
            <p className="mt-6 text-sm text-muted">
              New to MoneyMitra?{" "}
              <Link href="/signup" className="text-link">
                Create an account
              </Link>
            </p>
          </div>
        </div>
        <AuthShowcase className="hidden flex-1 lg:block" />
      </div>

      {/* ---------- Light mode: split-screen form + rotating brand panel ---------- */}
      <div className="relative hidden w-full gap-3.5 lg:flex dark:hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto rounded-3xl border border-line bg-card px-6 py-8 sm:px-10 lg:basis-[480px] lg:flex-none lg:px-12">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" aria-label="Back to MoneyMitra home" className="inline-flex">
              <Logo height={32} />
            </Link>
            <ThemeToggle />
          </div>
          <div className="mx-auto my-auto flex w-full max-w-[380px] flex-col py-10">
            <AuthHero
              icon={<LogIn className="h-6 w-6" strokeWidth={1.8} />}
              title="Welcome back"
              subtitle="Log in to your MoneyMitra workspace."
            />
            <form className="mt-7 flex flex-col gap-4" onSubmit={handleSubmit}>
              {lightFields("light-lg")}
            </form>
            <p className="mt-6 text-center text-sm text-muted">
              New to MoneyMitra?{" "}
              <Link href="/signup" className="text-link">
                Create an account
              </Link>
            </p>
          </div>
        </div>
        <AuthBrandPanel className="flex-1" />
      </div>

      {/* ---------- Light mode, small screens: plain centered card ---------- */}
      <Card className="w-full max-w-sm bg-card border-line lg:hidden dark:hidden">
        <AuthHero
          icon={<LogIn className="h-6 w-6" strokeWidth={1.8} />}
          title="Welcome back"
          subtitle="Log in to your MoneyMitra workspace."
        />
        <form className="mt-7 flex flex-col gap-4" onSubmit={handleSubmit}>
          {lightFields("light-sm")}
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          New to MoneyMitra?{" "}
          <Link href="/signup" className="text-link">
            Create an account
          </Link>
        </p>
      </Card>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <AuthBackdrop />
      <div className="lg:hidden dark:hidden">
        <PublicHeader />
      </div>
      <main className="relative flex flex-1 items-center justify-center p-4 lg:items-stretch lg:p-3.5 dark:items-stretch dark:p-3.5">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
