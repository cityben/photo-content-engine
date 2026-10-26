import { redirect } from "next/navigation";
import { AlertCircle, LockKeyhole } from "lucide-react";

import { auth, providerList, signIn } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_ALLOWED_DOMAINS } from "@/lib/access";

export const metadata = { title: "Sign in — Photo Content Engine" };

const ERRORS = {
  AccessDenied: "That account doesn't have access. Sign in with your company account.",
  Configuration: "Sign-in isn't set up correctly on the server. Check the AUTH_ settings.",
  Verification: "That sign-in link has expired. Try again.",
};

// Only same-site paths, so the login page can't be used to bounce users elsewhere.
function safeCallback(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const redirectTo = safeCallback(params?.callbackUrl);

  const session = await auth();
  if (session?.user) redirect(redirectTo);

  const error = params?.error ? ERRORS[params.error] || "Sign-in failed. Try again." : null;
  const domains = (process.env.AUTH_ALLOWED_DOMAINS ?? DEFAULT_ALLOWED_DOMAINS)
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

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
              <CardDescription>
                {domains.length
                  ? `Use your ${domains.map((d) => `@${d}`).join(" or ")} account.`
                  : "Use your company account."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}
            {providerList.length ? (
              providerList.map((provider) => (
                <form
                  key={provider.id}
                  action={async () => {
                    "use server";
                    await signIn(provider.id, { redirectTo });
                  }}
                >
                  <Button type="submit" size="lg" className="w-full">
                    Continue with {provider.name}
                  </Button>
                </form>
              ))
            ) : (
              <p className="rounded-md bg-gray-100 px-3 py-2.5 text-sm text-gray-700">
                No sign-in method is configured. Set the Microsoft or Google AUTH_ variables
                described in docs/SETUP.md.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
