import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

/** "Updated Tue 3 Nov, 09:12 · $0.02" — so nobody wonders how fresh it is. */
export function Freshness({ snap }) {
  if (!snap) return <span className="text-xs text-gray-500">Never fetched</span>;
  return (
    <span className="text-xs text-gray-500">
      Updated {formatDateTime(snap.createdAt)} · ${Number(snap.cost || 0).toFixed(3)}
    </span>
  );
}

export function SectionCard({ title, description, snap, action, children }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 max-w-[68ch] flex-col gap-1.5">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {action}
          {snap !== undefined && <Freshness snap={snap} />}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function NotConnected() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect DataForSEO for market data</CardTitle>
        <CardDescription>
          Competitors, keyword demand, reviews, backlinks and site health come from DataForSEO, which charges per request (usually a few cents). Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in
          Vercel — set DATAFORSEO_SANDBOX=true first to try it with free dummy data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" asChild>
          <Link href="/settings">Setup guide</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Link tabs (server-rendered, so each tab is its own URL). */
export function LinkTabs({ base, tabs, active, label }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1">
      <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map(([id, text]) => (
          <Link
            key={id}
            href={`${base}?tab=${id}`}
            aria-current={active === id ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
              active === id ? "bg-white text-gray-900 shadow-paper" : "text-gray-600 hover:text-gray-900"
            )}
          >
            {text}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Empty-state panel used across market pages. */
export function Empty({ children }) {
  return <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">{children}</p>;
}
