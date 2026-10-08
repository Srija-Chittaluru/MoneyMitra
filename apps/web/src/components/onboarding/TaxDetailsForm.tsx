"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/AuthContext";
import { saveTaxProfileRequest, skipTaxOnboardingRequest } from "@/lib/onboarding/api";
import {
  earliestDobISO,
  sanitizePan,
  todayISO,
  validateDob,
  validatePan,
} from "@/lib/onboarding/validation";

interface TaxDetailsFormProps {
  submitLabel: string;
  /** When set, a "Skip for now" option is shown. */
  onSkipped?: () => void;
  onSaved: () => void;
  onCancel?: () => void;
}

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <>
      {children}{" "}
      <span className="text-error" aria-hidden="true">
        *
      </span>
    </>
  );
}

export function TaxDetailsForm({ submitLabel, onSkipped, onSaved, onCancel }: TaxDetailsFormProps) {
  const { user, updateUser } = useAuth();

  const [pan, setPan] = useState("");
  const [dob, setDob] = useState(user?.date_of_birth ?? "");
  const [panError, setPanError] = useState<string | null>(null);
  const [dobError, setDobError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const busy = submitting || skipping;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setApiError(null);

    const nextPanError = validatePan(pan);
    const nextDobError = validateDob(dob);
    setPanError(nextPanError);
    setDobError(nextDobError);
    if (nextPanError || nextDobError) return;

    setSubmitting(true);
    try {
      const updated = await saveTaxProfileRequest({ pan: pan.trim().toUpperCase(), date_of_birth: dob });
      updateUser(updated);
      onSaved();
    } catch (error) {
      setApiError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    setApiError(null);
    setSkipping(true);
    try {
      const updated = await skipTaxOnboardingRequest();
      updateUser(updated);
      onSkipped?.();
    } catch (error) {
      setApiError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSkipping(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <Input
        id="pan"
        label={<RequiredLabel>PAN Number</RequiredLabel>}
        placeholder="ABCDE1234F"
        value={pan}
        onChange={(e) => {
          setPan(sanitizePan(e.target.value));
          if (panError) setPanError(null);
        }}
        error={panError ?? undefined}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={10}
        aria-required="true"
        className="uppercase tracking-wider bg-field border-line"
      />
      <Input
        id="dob"
        type="date"
        label={<RequiredLabel>Date of Birth</RequiredLabel>}
        value={dob}
        onChange={(e) => {
          setDob(e.target.value);
          if (dobError) setDobError(null);
        }}
        error={dobError ?? undefined}
        min={earliestDobISO()}
        max={todayISO()}
        autoComplete="bday"
        aria-required="true"
        className="bg-field border-line"
      />
      {apiError && <p className="text-sm text-error">{apiError}</p>}
      <div className="mt-2 flex flex-col gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
        {onSkipped && (
          <Button type="button" variant="ghost" onClick={handleSkip} disabled={busy}>
            {skipping ? "Skipping…" : "Skip for now"}
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
