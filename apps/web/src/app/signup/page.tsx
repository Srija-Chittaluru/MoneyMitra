"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicHeader } from "@/components/shell/PublicHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/AuthContext";
import { ApiError } from "@/lib/api-client";

export default function SignupPage() {
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

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <h1 className="text-h1 mb-1">Create your account</h1>
          <p className="mb-6 text-sm text-muted">Start understanding your taxes and money.</p>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <Input
              id="name"
              label="Full name"
              placeholder="Aditi Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
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
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Input
              id="confirm-password"
              type="password"
              label="Confirm password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Input
              id="dob"
              type="date"
              label="Date of birth (optional)"
              hint="Used once to power life-stage guidance later"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
            {(fieldError || apiError) && (
              <p className="text-sm text-error">{fieldError ?? apiError}</p>
            )}
            <Button type="submit" variant="primary" className="mt-2" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-link">
              Log in
            </Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
