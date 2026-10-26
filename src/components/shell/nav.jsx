"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Crop,
  Crosshair,
  FileText,
  FolderOpen,
  KanbanSquare,
  LayoutDashboard,
  Lightbulb,
  Search,
  Settings,
  Handshake,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/focus", label: "Focus", icon: Crosshair },
  { href: "/jobs", label: "Jobs", icon: FolderOpen },
  { href: "/ideas", label: "Content pipeline", icon: KanbanSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/sizer", label: "Social sizer", icon: Crop },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/keywords", label: "Search & market", icon: Search },
  { href: "/reputation", label: "Reputation & authority", icon: ShieldCheck },
  { href: "/leads", label: "Leads", icon: Handshake },
  { href: "/insights", label: "Growth insights", icon: Lightbulb },
  { href: "/reports", label: "Monthly report", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Nav({ onNavigate }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
              active ? "bg-primary-soft text-primary" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
