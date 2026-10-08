"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TaxDetailsForm } from "@/components/onboarding/TaxDetailsForm";
import { useAuth } from "@/lib/auth/AuthContext";

function safeDestination(next: string | null): string {
  // Only same-site absolute paths; never "//host" or "/\host".
  return next && /^\/(?![/\\])/.test(next) ? next : "/dashboard";
}

function OnboardingContent() {
  const { user, status } = useAuth();
  const router = useRouter();
  const destination = safeDestination(useSearchParams().get("next"));

  const alreadyCompleted = user?.tax_onboarding_status === "completed";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (alreadyCompleted) {
      router.replace(destination);
    }
  }, [status, alreadyCompleted, destination, router]);

  if (status !== "authenticated" || alreadyCompleted) {
    return (
      <div className="flex w-full max-w-md flex-col gap-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md bg-card border-line">
      <h1 className="text-h1 mb-1">Tell us about you</h1>
      <p className="mb-6 text-sm text-muted">
        We&apos;ll use these details to personalize your tax and finance experience.
      </p>
      <TaxDetailsForm
        submitLabel="Continue"
        onSaved={() => router.replace(destination)}
        onSkipped={() => router.replace(destination)}
      />
    </Card>
  );
}

export default function OnboardingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-line bg-frame px-4 py-4 md:px-8">
        <Link href="/" className="flex items-center">
          <Logo height={40} />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <Suspense fallback={null}>
          <OnboardingContent />
        </Suspense>
      </main>
    </div>
  );
}
