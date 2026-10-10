"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthBackdrop } from "@/components/auth/AuthBackdrop";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
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
 * Light mode has no equivalent photography, so it gets its own composition
 * instead. Both blocks render from the SAME state/handlers in this
 * component — only one is ever visible (CSS `dark:`/`hidden`) — so
 * switching theme mid-form never loses what you've typed.
 */
function SignupForm() {
  const { signup, status } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dob, setDob] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setApiError(null);

    if (!name.trim() || !email.trim() || !password) {
      setFieldError("Fill in your name, email, and password.");
      return;
    }
    if (password.length < 8) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }
    if (password.length < 12 && !(/[A-Za-z]/.test(password) && /[^A-Za-z]/.test(password))) {
      setFieldError("Use at least 12 characters, or mix letters with numbers or symbols.");
      return;
    }
    if (password !== confirmPassword) {
      setFieldError("Passwords don't match.");
      return;
    }
    setFieldError(null);

    setSubmitting(true);
    try {
      await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        date_of_birth: dob || undefined,
      });
      router.push("/dashboard");
    } catch (error) {
      setApiError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const fields = (idPrefix: string) => (
    <>
      <Input
        id={`${idPrefix}-name`}
        label="Full name"
        placeholder="Aditi Sharma"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        required
        className="bg-field border-line"
      />
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
        placeholder="At least 8 characters"
        hint="Mix letters with numbers or symbols. Avoid common passwords and your email name."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        required
        className="bg-field border-line"
      />
      <PasswordInput
        id={`${idPrefix}-confirm-password`}
        label="Confirm password"
        placeholder="Re-enter your password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
        required
        className="bg-field border-line"
      />
      <Input
        id={`${idPrefix}-dob`}
        type="date"
        label="Date of birth (optional)"
        hint="Used once to power life-stage guidance later"
        value={dob}
        onChange={(e) => setDob(e.target.value)}
        className="bg-field border-line"
      />
      {(fieldError || apiError) && <p className="text-sm text-error">{fieldError ?? apiError}</p>}
      <Button type="submit" variant="primary" className="mt-2" disabled={submitting}>
        {submitting ? "Creating your account…" : "Create account"}
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
            <h1 className="text-h1 mb-1">Your money deserves a clearer picture.</h1>
            <p className="mb-7 text-sm text-muted">
              Bring your income, taxes, investments and financial documents together. Understand where you stand
              and discover what to do next.
            </p>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              {fields("dark")}
            </form>
            <p className="mt-6 text-sm text-muted">
              Already have an account?{" "}
              <Link href="/login" className="text-link">
                Log in
              </Link>
            </p>
          </div>
        </div>
        <AuthShowcase className="hidden flex-1 lg:block" />
      </div>

      {/* ---------- Light mode: split-screen brand panel + form ---------- */}
      <div className="relative hidden w-full gap-3.5 lg:flex dark:hidden">
        <AuthBrandPanel variant="signup" className="flex-1" />
        <div className="flex shrink-0 flex-col justify-center p-8 lg:basis-[420px] xl:p-10">
          <p className="text-sm font-medium text-muted">Get started</p>
          <h1 className="mb-2 mt-1 text-h1">Create your account</h1>
          <p className="mb-6 text-sm text-muted">
            Bring your income, taxes, investments and documents together — understand where you stand.
          </p>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            {fields("light-lg")}
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-link">
              Log in
            </Link>
          </p>
        </div>
      </div>

      {/* ---------- Light mode, small screens: plain centered card, no floating flourishes ---------- */}
      <Card className="relative w-full max-w-sm bg-card border-line lg:hidden dark:hidden">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent-text">
          Free to get started
        </span>
        <h1 className="text-h1 mb-1">Your money deserves a clearer picture.</h1>
        <p className="mb-6 text-sm text-muted">
          Bring your income, taxes, investments and financial documents together. Understand where you stand and
          discover what to do next.
        </p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {fields("light-sm")}
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-link">
            Log in
          </Link>
        </p>
      </Card>
    </>
  );
}

export default function SignupPage() {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <AuthBackdrop />
      <div className="dark:hidden">
        <PublicHeader />
      </div>
      <main className="relative flex flex-1 items-center justify-center p-4 dark:items-stretch dark:p-3.5">
        <SignupForm />
      </main>
    </div>
  );
}
