import { LogOut } from "lucide-react";

import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export function SiteHeader({ user }) {
  return (
    <header className="bg-white shadow-paper">
      <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-3 sm:px-6">
        <span aria-hidden className="h-6 w-1.5 rounded-full bg-primary" />
        <span className="text-sm font-bold uppercase tracking-wider text-primary">Content Engine</span>
        {user && (
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <span className="hidden truncate text-sm text-gray-600 md:inline">{user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button variant="ghost" size="sm" type="submit">
                <LogOut /> Sign out
              </Button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
