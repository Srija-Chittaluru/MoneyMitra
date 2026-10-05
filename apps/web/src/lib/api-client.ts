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
      .then((body: { detail?: string }) => (typeof body.detail === "string" ? body.detail : undefined))
      .catch(() => undefined);
    throw new ApiError(response.status, message ?? `Request to ${path} failed with ${response.status}`);
  }

  return response;
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
