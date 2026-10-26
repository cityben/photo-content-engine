import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { isAllowedSignIn } from "@/lib/access";

// Only offer the sign-in methods that have credentials configured.
const configured = [
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID && {
    provider: MicrosoftEntraID({ name: "Microsoft 365" }),
    label: "Microsoft 365",
  },
  process.env.AUTH_GOOGLE_ID && {
    provider: Google({ name: "Google Workspace" }),
    label: "Google Workspace",
  },
].filter(Boolean);

const providers = configured.map((c) => c.provider);

export const providerList = configured.map((c) => ({ id: c.provider.id, name: c.label }));

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
