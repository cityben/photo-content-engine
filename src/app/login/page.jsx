import { redirect } from "next/navigation";
import { AlertCircle, LockKeyhole } from "lucide-react";

import { auth, microsoftEnabled, passwordAccountsConfigured } from "@/auth";
import { signInWithMicrosoft } from "@/app/login/actions";
import { PasswordForm } from "@/components/password-form";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeCallback } from "@/lib/redirects";

export const metadata = { title: "Sign in — Photo Content Engine" };

// Errors that arrive via redirect (Microsoft sign-in, misconfiguration).
const ERRORS = {
  AccessDenied: "That Microsoft account doesn't have access. Use your company account.",
  Configuration: "Sign-in isn't set up correctly on the server. Check the AUTH_ settings.",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params?.callbackUrl);

  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  const error = params?.error ? ERRORS[params.error] || "Sign-in failed. Try again." : null;
  const passwords = passwordAccountsConfigured();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm">
          <CardHeader className="gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
              <LockKeyhole className="size-5" />
            </span>
            <div className="flex flex-col gap-1.5">
              <CardTitle className="text-xl">Sign in</CardTitle>
              <CardDescription>Ask your administrator if you need an account.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}

            {passwords ? (
              <PasswordForm callbackUrl={callbackUrl} />
            ) : (
              <p className="rounded-md bg-gray-100 px-3 py-2.5 text-sm text-gray-700">
                No accounts are set up yet. Add people to AUTH_USERS — see docs/SETUP.md.
              </p>
            )}

            {microsoftEnabled && (
              <>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="h-px flex-1 bg-gray-100" />
                  or
                  <span className="h-px flex-1 bg-gray-100" />
                </div>
                <form action={signInWithMicrosoft}>
                  <input type="hidden" name="callbackUrl" value={callbackUrl} />
                  <Button type="submit" variant="outline" size="lg" className="w-full">
                    Continue with Microsoft 365
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
