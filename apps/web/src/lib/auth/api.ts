import { apiFetch } from "@/lib/api-client";
import type { LoginInput, SignupInput, TokenResponse, User } from "./types";

export function signupRequest(input: SignupInput) {
  return apiFetch<TokenResponse>("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function loginRequest(input: LoginInput) {
  return apiFetch<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function refreshRequest() {
  return apiFetch<TokenResponse>("/api/v1/auth/refresh", { method: "POST" });
}

export function logoutRequest() {
  return apiFetch<void>("/api/v1/auth/logout", { method: "POST" });
}

export function meRequest() {
  return apiFetch<User>("/api/v1/auth/me");
}
