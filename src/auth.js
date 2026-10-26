import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { isAllowedSignIn } from "@/lib/access";
import {
  checkCredentials,
  clearFailures,
  isLockedOut,
  parseUsers,
  recordFailure,
} from "@/lib/passwords";

function clientIp(request) {
  const forwarded = request?.headers?.get?.("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : null;
}

const providers = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials, request) {
      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const ip = clientIp(request);
      const keys = [`email:${email}`, ip && `ip:${ip}`];

      if (!email || !credentials?.password || isLockedOut(keys)) return null;

      const user = await checkCredentials(email, credentials.password);
      if (!user) {
        recordFailure(keys);
        console.warn(`[auth] Failed password sign-in for ${email}${ip ? ` from ${ip}` : ""}`);
        return null;
      }
      clearFailures([`email:${email}`]);
      return { id: user, email: user, name: user.split("@")[0] };
    },
  }),
];

// Optional: company Microsoft 365 sign-in, enabled when its keys are set.
export const microsoftEnabled = Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID);
if (microsoftEnabled) {
  providers.push(MicrosoftEntraID({ name: "Microsoft 365" }));
}

export function passwordAccountsConfigured() {
  return parseUsers().size > 0;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: {
    strategy: "jwt",
    // Sign in again every 12 hours.
    maxAge: 12 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    signIn({ account, profile, user }) {
      const allowed = isAllowedSignIn({
        provider: account?.provider,
        profile,
        email: profile?.email || user?.email,
      });
      if (!allowed) {
        console.warn(
          `[auth] Denied sign-in for ${profile?.email || user?.email || "unknown"} via ${account?.provider}`
        );
      }
      return allowed;
    },
  },
});
