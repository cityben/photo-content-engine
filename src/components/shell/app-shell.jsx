import Link from "next/link";
import { LogOut, Plus } from "lucide-react";

import { signOut } from "@/auth";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Nav } from "@/components/shell/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { postingEnabled, socialMode } from "@/lib/social";

// The company name comes from Settings → Company profile, not the code.
function Brand({ name }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
      <span aria-hidden className="h-7 w-1.5 rounded-full bg-primary" />
      <span className="flex flex-col leading-tight">
        <span className="text-xs font-bold uppercase tracking-wider text-primary">{name || "Content Engine"}</span>
        {name && <span className="text-xs text-gray-500">Content Engine</span>}
      </span>
    </Link>
  );
}

function ModeBadge() {
  const mode = socialMode();
  if (mode === "sandbox") return <Badge variant="secondary">Sandbox — nothing posts</Badge>;
  return postingEnabled() ? <Badge variant="success">Live — Buffer</Badge> : <Badge variant="secondary">Live — read only</Badge>;
}

function UserFooter({ user }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-gray-50 p-3">
      <ModeBadge />
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-gray-600">{user?.email}</span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="ghost" size="icon-sm" type="submit" aria-label="Sign out" title="Sign out">
            <LogOut />
          </Button>
        </form>
      </div>
    </div>
  );
}

export function AppShell({ user, brandName, children }) {
  return (
    <TooltipProvider>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 bg-white p-4 shadow-paper lg:flex print:hidden">
          <Brand name={brandName} />
          <Button asChild className="w-full">
            <Link href="/jobs/new">
              <Plus /> New job
            </Link>
          </Button>
          <Nav />
          <div className="mt-auto">
            <UserFooter user={user} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-white px-4 py-3 shadow-paper lg:hidden print:hidden">
            <div className="flex items-center gap-2">
              <MobileNav footer={<UserFooter user={user} />} />
              <Brand name={brandName} />
            </div>
            <Button asChild size="sm">
              <Link href="/jobs/new">
                <Plus /> New job
              </Link>
            </Button>
          </header>
          <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-[68ch] flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{title}</h1>
        {description && <p className="text-sm text-gray-600 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
