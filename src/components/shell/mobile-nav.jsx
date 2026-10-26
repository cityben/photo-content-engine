"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Nav } from "@/components/shell/nav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileNav({ footer }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-4">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="mt-8 flex flex-1 flex-col gap-6">
          <Nav onNavigate={() => setOpen(false)} />
          <div className="mt-auto">{footer}</div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
