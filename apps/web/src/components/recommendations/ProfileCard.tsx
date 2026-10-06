"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ApiError } from "@/lib/api-client";
import { updateRecommendationProfile } from "@/lib/recommendations/api";
import type { EmployeeCategory, RecommendationProfile } from "@/lib/recommendations/types";

const CATEGORY_OPTIONS: { value: EmployeeCategory; label: string }[] = [
  { value: "government", label: "Government" },
  { value: "psu", label: "PSU" },
  { value: "private", label: "Private sector" },
  { value: "other", label: "Other" },
];

interface ProfileCardProps {
  profile: RecommendationProfile;
  taxYear: string;
  availableTaxYears: string[];
  onTaxYearChange: (taxYear: string) => void;
}

export function ProfileCard({ profile, taxYear, availableTaxYears, onTaxYearChange }: ProfileCardProps) {
  const queryClient = useQueryClient();
  const [dob, setDob] = useState(profile.date_of_birth ?? "");
  const [category, setCategory] = useState<string>(profile.employee_category ?? "");
  const [income, setIncome] = useState(
    profile.expected_annual_income === null ? "" : String(profile.expected_annual_income),
  );

  const mutation = useMutation({
    mutationFn: updateRecommendationProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recommendations"] }),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({
      date_of_birth: dob || null,
      employee_category: (category || null) as EmployeeCategory | null,
      expected_annual_income: income === "" ? null : Math.round(Number(income)),
    });
  }

  const error =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.isError
        ? "Couldn't save your profile. Please try again."
        : null;

  return (
    <Card className="mb-6">
      <h3 className="text-h2 mb-1">Your profile</h3>
      <p className="mb-4 text-sm text-muted">
        The more you tell us, the more specific your recommendations get. Everything here is optional except
        your date of birth.
      </p>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          id="profile-dob"
          type="date"
          label="Date of birth"
          className="w-full min-w-0"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
        />
        <Select
          id="profile-category"
          label="Employee category"
          className="w-full min-w-0"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Not specified</option>
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Input
          id="profile-income"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          label="Expected annual income (₹)"
          placeholder="e.g. 1200000"
          className="w-full min-w-0"
          value={income}
          onChange={(e) => setIncome(e.target.value)}
        />
        <Select
          id="profile-tax-year"
          label="Tax year"
          className="w-full min-w-0"
          value={taxYear}
          onChange={(e) => onTaxYearChange(e.target.value)}
        >
          {availableTaxYears.map((year) => (
            <option key={year} value={year}>
              FY {year}
            </option>
          ))}
        </Select>
        <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4 sm:flex-row sm:items-center">
          <Button type="submit" variant="primary" size="sm" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save profile"}
          </Button>
          {mutation.isSuccess && !error && <span className="text-sm text-success">Saved</span>}
          {error && <span className="text-sm text-error">{error}</span>}
        </div>
      </form>
    </Card>
  );
}
