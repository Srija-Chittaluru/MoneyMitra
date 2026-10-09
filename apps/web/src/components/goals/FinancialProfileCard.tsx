"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api-client";
import { formatRupees } from "@/lib/format";
import { getFinancialProfile, saveFinancialProfile } from "@/lib/goals/api";
import { MAX_MONTHLY_AMOUNT, parseRupees, rupeeError } from "@/lib/goals/form";
import { goalKeys, refreshGoals } from "@/lib/goals/queries";
import type { FinancialProfile } from "@/lib/goals/types";

type Field = keyof FinancialProfile;

const EXPENSES_HINT =
  "Rent, EMIs, bills, insurance and investments you don't track here. Leave out your MoneyMitra goals; they're counted separately.";

function ProfileForm({ profile, onDone }: { profile: FinancialProfile; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [takeHome, setTakeHome] = useState(profile.monthly_take_home?.toString() ?? "");
  const [expenses, setExpenses] = useState(profile.monthly_expenses?.toString() ?? "");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const mutation = useMutation<FinancialProfile, ApiError, FinancialProfile>({
    mutationFn: saveFinancialProfile,
    onSuccess: (saved) => {
      queryClient.setQueryData(goalKeys.financialProfile, saved);
      // Affordability for every goal depends on these figures.
      refreshGoals(queryClient);
      onDone();
    },
    onError: (error) => setErrors(error.fieldErrors as Partial<Record<Field, string>>),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const takeHomeValue = parseRupees(takeHome);
    const expensesValue = parseRupees(expenses);
    const next: Partial<Record<Field, string>> = {};
    const takeHomeError = rupeeError(takeHomeValue, { min: 1, max: MAX_MONTHLY_AMOUNT, required: false });
    if (takeHomeError) next.monthly_take_home = takeHomeError;
    const expensesError = rupeeError(expensesValue, { min: 0, max: MAX_MONTHLY_AMOUNT, required: false });
    if (expensesError) next.monthly_expenses = expensesError;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    // Empty means "not given": sent as null, never as zero.
    mutation.mutate({ monthly_take_home: takeHomeValue, monthly_expenses: expensesValue });
  }

  const formError =
    mutation.isError && Object.keys(mutation.error.fieldErrors).length === 0 ? mutation.error.message : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input
        id="profile-take-home"
        label="Monthly take-home pay (₹)"
        inputMode="numeric"
        placeholder="Leave empty if you'd rather not say"
        value={takeHome}
        onChange={(e) => setTakeHome(e.target.value)}
        error={errors.monthly_take_home}
        hint={errors.monthly_take_home ? undefined : "What reaches your bank account each month, after tax and deductions."}
        className="bg-field border-line"
      />
      <Input
        id="profile-expenses"
        label="Typical monthly expenses (₹)"
        inputMode="numeric"
        placeholder="Leave empty if you're not sure"
        value={expenses}
        onChange={(e) => setExpenses(e.target.value)}
        error={errors.monthly_expenses}
        hint={errors.monthly_expenses ? undefined : EXPENSES_HINT}
        className="bg-field border-line"
      />
      {formError && <p className="text-sm text-error">{formError}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function Amount({ label, value, empty }: { label: string; value: number | null; empty: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      {value === null ? (
        <p className="mt-0.5 text-sm text-muted">{empty}</p>
      ) : (
        <p className="mt-0.5 font-semibold text-foreground">{formatRupees(value)}</p>
      )}
    </div>
  );
}

/** The monthly figures goal affordability is checked against. */
export function FinancialProfileCard() {
  const query = useQuery({ queryKey: goalKeys.financialProfile, queryFn: getFinancialProfile });
  const [editing, setEditing] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const profile = query.data;

  function openForm() {
    setFormKey((k) => k + 1);
    setEditing(true);
  }

  return (
    <Card className="flex flex-col gap-4 border-line bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex min-w-0 items-start gap-3">
        <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-muted" strokeWidth={1.5} />
        <div className="min-w-0">
          <p className="font-semibold text-foreground">Your monthly budget</p>
          <p className="text-sm text-muted">
            Used to check whether each goal fits. Without both figures we won&apos;t say whether a goal is affordable.
          </p>
        </div>
      </div>

      {query.isPending ? (
        <Skeleton className="h-10 w-56" />
      ) : query.isError ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-error">Couldn&apos;t load your budget.</p>
          <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Amount label="Take-home pay" value={profile!.monthly_take_home} empty="Not added" />
          <Amount label="Expenses" value={profile!.monthly_expenses} empty="Not added" />
          <Button variant="secondary" size="sm" onClick={openForm}>
            {profile!.monthly_take_home === null && profile!.monthly_expenses === null ? "Add figures" : "Edit"}
          </Button>
        </div>
      )}

      <Dialog open={editing} onClose={() => setEditing(false)} title="Your monthly budget">
        {profile && <ProfileForm key={formKey} profile={profile} onDone={() => setEditing(false)} />}
      </Dialog>
    </Card>
  );
}
