import { NextResponse } from "next/server";

import { auth } from "@/auth";

const PUBLIC_PATHS = ["/login"];

/**
 * Every page and API route requires a signed-in user. API routes get a 401;
 * pages redirect to /login and come back afterwards. Exceptions: /api/v1/*,
 * which requires an integration API key, and /api/cron/*, which requires
 * CRON_SECRET (both checked in each route).
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  // /api/v1/* is for other systems: those routes check their own API key.
  // /api/cron/* is called by Vercel Cron and checks CRON_SECRET itself.
  if (req.auth?.user || PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/api/v1/") || pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const login = new URL("/login", req.nextUrl.origin);
  if (pathname !== "/") {
    login.searchParams.set("callbackUrl", `${pathname}${search}`);
  }
  return NextResponse.redirect(login);
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
