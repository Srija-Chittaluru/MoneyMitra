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
  /** From Level 2 the user's own figures replace expected income, so the estimate-only fields are hidden. */
  level: number;
  taxYear: string;
  availableTaxYears: string[];
  onTaxYearChange: (taxYear: string) => void;
  /** Called after a successful save. The card remounts when the profile changes, so the parent shows "Saved". */
  onSaved: () => void;
  justSaved: boolean;
}

export function ProfileCard({
  profile,
  level,
  taxYear,
  availableTaxYears,
  onTaxYearChange,
  onSaved,
  justSaved,
}: ProfileCardProps) {
  // Expected income and tax year only feed the estimate made before the user has real figures.
  const showEstimateFields = level < 2;
  const queryClient = useQueryClient();
  const [dob, setDob] = useState(profile.date_of_birth ?? "");
  const [category, setCategory] = useState<string>(profile.employee_category ?? "");
  const [income, setIncome] = useState(
    profile.expected_annual_income === null ? "" : String(profile.expected_annual_income),
  );

  const mutation = useMutation({
    mutationFn: updateRecommendationProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-recommendations"] });
      onSaved();
    },
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
        {showEstimateFields
          ? "The more you tell us, the more specific your recommendations get. Everything here is optional except your date of birth."
          : "Your recommendations now use your own figures. Your date of birth and employee category still shape your advice."}
      </p>
      <form
        onSubmit={handleSubmit}
        className={`grid gap-4 sm:grid-cols-2 ${showEstimateFields ? "lg:grid-cols-4" : ""}`}
      >
        <Input
          id="profile-dob"
          type="date"
          label="Date of birth"
          hint="Sets your life stage and age-based limits"
          className="w-full min-w-0"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
        />
        <Select
          id="profile-category"
          label="Employee category"
          hint="Adjusts the employer NPS advice"
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
        {showEstimateFields && (
          <>
            <Input
              id="profile-income"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              label="Expected annual income (₹)"
              hint="Used only until you add your real figures"
              placeholder="e.g. 1200000"
              className="w-full min-w-0"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
            />
            <Select
              id="profile-tax-year"
              label="Tax year"
              hint="The year for that estimate"
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
          </>
        )}
        <div
          className={`flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center ${showEstimateFields ? "lg:col-span-4" : ""}`}
        >
          <Button type="submit" variant="primary" size="sm" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save profile"}
          </Button>
          {justSaved && !error && <span className="text-sm text-success">Saved</span>}
          {error && <span className="text-sm text-error">{error}</span>}
        </div>
      </form>
    </Card>
  );
}
