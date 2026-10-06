export type TaxOnboardingStatus = "completed" | "skipped";

export interface User {
  id: string;
  name: string;
  email: string;
  date_of_birth: string | null;
  /** Masked (XXXXX1234F); the full PAN is never returned by the API. */
  pan_masked: string | null;
  /** null until the user has seen the post-signup tax onboarding step. */
  tax_onboarding_status: TaxOnboardingStatus | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  date_of_birth?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
