import { auth } from "@/auth";

/**
 * Second line of defence behind src/proxy.js: API routes check the session
 * themselves so they stay protected even if the proxy matcher changes.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    return {
      user: null,
      response: Response.json({ error: "Sign in required" }, { status: 401 }),
    };
  }
  return { user: session.user, response: null };
}
