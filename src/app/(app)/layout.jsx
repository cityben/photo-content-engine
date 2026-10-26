import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OptionsProvider } from "@/components/options-provider";
import { AppShell } from "@/components/shell/app-shell";
import { getProfile, optionsOf } from "@/lib/profile";

export default async function AppLayout({ children }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const profile = await getProfile();
  return (
    <OptionsProvider value={optionsOf(profile)}>
      <AppShell user={session.user} brandName={profile.name}>
        {children}
      </AppShell>
    </OptionsProvider>
  );
}
