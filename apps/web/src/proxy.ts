import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/documents",
  "/tax-comparison",
  "/itr-filing",
  "/recommendations",
  "/finance",
  "/profile",
  "/onboarding",
];

/**
 * Fast, presence-only check on the HttpOnly refresh cookie — avoids a flash
 * of protected content before redirecting. This is a UX nicety, not the
 * security boundary: every API call is still independently authorized by
 * the backend via the access token.
 */
export function proxy(request: NextRequest) {
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("refresh_token");
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/documents/:path*",
    "/tax-comparison/:path*",
    "/itr-filing/:path*",
    "/recommendations/:path*",
    "/finance/:path*",
    "/profile/:path*",
    "/onboarding/:path*",
  ],
};
