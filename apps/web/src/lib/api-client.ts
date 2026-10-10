import { API_BASE_URL } from "./env";
import { getAccessToken } from "./auth/token-store";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const accessToken = getAccessToken();
  const headers = new Headers(init?.headers);
  // FormData bodies need the browser to set the multipart boundary itself.
  if (!(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const message = await response
      .json()
      .then((body: { detail?: unknown }) => errorDetail(body.detail))
      .catch(() => undefined);
    throw new ApiError(response.status, message ?? FALLBACK_MESSAGES[response.status] ?? `Request to ${path} failed with ${response.status}`);
  }

  return response;
}

const FALLBACK_MESSAGES: Record<number, string> = {
  413: "That's too large to send. Try a smaller file.",
  429: "Too many requests. Please wait a few minutes and try again.",
  500: "Something went wrong on our side. Please try again.",
};

// FastAPI sends a string for handled errors and a list for validation errors.
function errorDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: unknown[]; type?: string };
    const msg = (first.msg ?? "").replace(/^Value error, /, "");
    if (first.type === "less_than_equal") return "One of the amounts is unrealistically large. Please check it.";
    const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : undefined;
    return field && typeof field === "string" && first.type !== "value_error" ? `${field.replace(/_/g, " ")}: ${msg}` : msg;
  }
  return undefined;
}

export async function apiFetchBlob(path: string, init?: RequestInit): Promise<Blob> {
  const response = await request(path, init);
  return response.blob();
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init);

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
