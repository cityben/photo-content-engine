import { NextResponse } from "next/server";

import { auth } from "@/auth";

const PUBLIC_PATHS = ["/login"];

/**
 * Every page and API route requires a signed-in user. API routes get a 401;
 * pages redirect to /login and come back afterwards.
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  if (req.auth?.user || PUBLIC_PATHS.includes(pathname)) {
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
