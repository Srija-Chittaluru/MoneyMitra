/**
 * Holds the current access token in memory only — never localStorage/
 * sessionStorage. Cleared on reload by design; session is restored via a
 * silent refresh (using the HttpOnly refresh cookie) on app boot.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
