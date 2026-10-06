"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TaxDetailsForm } from "@/components/onboarding/TaxDetailsForm";
import { useHasMounted } from "@/lib/use-has-mounted";
import { useAuth } from "@/lib/auth/AuthContext";

const THEME_OPTIONS = ["Light", "Dark", "System"] as const;
type ThemeOption = (typeof THEME_OPTIONS)[number];

export default function ProfilePage() {
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [editingTax, setEditingTax] = useState(false);

  const current: ThemeOption =
    !mounted || theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light";

  if (!user) return null;

  const memberSince = new Date(user.created_at).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <AppShell title="Profile / Settings">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col items-center gap-3 text-center lg:col-span-1">
          <Avatar initial={user.name.charAt(0).toUpperCase()} size="lg" />
          <div>
            <p className="font-semibold text-foreground">{user.name}</p>
            <p className="text-sm text-muted">{user.email}</p>
          </div>
          <p className="text-xs text-muted">Member since {memberSince}</p>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="text-h2 mb-4">Profile information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="name" label="Full name" defaultValue={user.name} readOnly />
            <Input id="email" type="email" label="Email" defaultValue={user.email} readOnly />
            <Input
              id="dob"
              type="date"
              label="Date of birth"
              defaultValue={user.date_of_birth ?? ""}
              readOnly
            />
          </div>
          <p className="mt-4 text-sm text-muted">
            Profile editing isn&apos;t available yet.
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <h3 className="text-h2 mb-4">Tax details</h3>
        {user.tax_onboarding_status === "completed" && !editingTax ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="text-muted">PAN</p>
              <p className="font-medium text-foreground">{user.pan_masked ?? "Saved"}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEditingTax(true)}>
              Update details
            </Button>
          </div>
        ) : (
          <div className="max-w-md">
            <p className="mb-4 text-sm text-muted">
              {user.tax_onboarding_status === "completed"
                ? "Enter your PAN and date of birth to update them."
                : "Add your PAN and date of birth to personalize your tax and finance experience."}
            </p>
            <TaxDetailsForm
              submitLabel="Save"
              onSaved={() => setEditingTax(false)}
              onCancel={user.tax_onboarding_status === "completed" ? () => setEditingTax(false) : undefined}
            />
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <h3 className="text-h2 mb-4">Appearance</h3>
        <p className="mb-3 text-sm text-muted">Theme</p>
        <SegmentedControl
          options={THEME_OPTIONS}
          value={current}
          onChange={(value) => setTheme(value.toLowerCase())}
        />
      </Card>

      <Card className="mt-6">
        <h3 className="text-h2 mb-4">Account settings</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout().finally(() => router.push("/"));
            }}
          >
            Log out
          </Button>
        </div>
      </Card>
    </AppShell>
  );
}
