"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BellRing, Check, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const POLL = 5 * 60 * 1000;
const DOT = { high: "bg-destructive", medium: "bg-primary", low: "bg-gray-400" };
const LATER = [
  ["hours", "In 3 hours"],
  ["tomorrow", "Tomorrow"],
  ["week", "Next week"],
];

function readAlerts() {
  try {
    return localStorage.getItem("todo-alerts") === "on";
  } catch {
    return false;
  }
}

function Item({ item, onAct, busy, onNavigate }) {
  const [later, setLater] = useState(false);
  return (
    <li className="flex flex-col gap-2 rounded-lg bg-white p-3 shadow-paper">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[item.severity])} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link href={item.href || "/"} onClick={onNavigate} className="text-sm font-medium text-gray-900 underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring">
            {item.title}
          </Link>
          {item.detail && <p className="line-clamp-3 text-xs leading-5 text-gray-600">{item.detail}</p>}
          {item.recurred && <p className="text-xs font-medium text-destructive">Came back after being marked done</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 pl-4">
        {later ? (
          <>
            {LATER.map(([id, label]) => (
              <Button key={id} size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy} onClick={() => onAct(item, "snooze", id)}>
                {label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setLater(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={busy} onClick={() => onAct(item, "done")}>
              <Check /> Done
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={busy} onClick={() => setLater(true)}>
              <Clock /> Later
            </Button>
          </>
        )}
        {busy && <Loader2 className="size-3.5 animate-spin text-gray-500" />}
      </div>
    </li>
  );
}

/**
 * The to-do bell: what needs you now, from every part of the tool. Polls
 * every five minutes while open in a tab; optional desktop alerts fire when
 * something new and urgent appears (only while the app is open).
 */
export function NotificationBell() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  // Rendered only inside the closed sheet, so no server/client mismatch.
  const [alerts, setAlerts] = useState(readAlerts);
  const seen = useRef(null);

  const load = useCallback(async () => {
    try {
      const next = await api("/api/notifications");
      setData(next);
      const urgent = next.items.filter((i) => i.severity === "high").map((i) => i.key);
      if (seen.current && readAlerts() && typeof Notification !== "undefined" && Notification.permission === "granted") {
        const fresh = next.items.filter((i) => i.severity === "high" && !seen.current.has(i.key));
        if (fresh.length) new Notification(fresh.length === 1 ? fresh[0].title : `${fresh.length} new things need you`, { body: fresh[0].detail || "", tag: "content-engine-todo" });
      }
      seen.current = new Set(urgent);
    } catch {
      // Quiet: the bell just keeps its last state.
    }
  }, []);

  useEffect(() => {
    const t = setInterval(load, POLL);
    return () => clearInterval(t);
  }, [load]);

  // On load, and fresh counts after moving around the app (approving, scheduling…).
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [pathname, load]);

  const act = async (item, action, later) => {
    setBusy(item.key);
    try {
      setData(await api("/api/notifications", { method: "POST", body: { key: item.key, fingerprint: item.fingerprint, action, ...(later && { later }) } }));
      if (action === "snooze") toast.success("It'll come back then.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const toggleAlerts = async () => {
    if (alerts) {
      try {
        localStorage.setItem("todo-alerts", "off");
      } catch {}
      return setAlerts(false);
    }
    if (typeof Notification === "undefined") return toast.error("This browser can't show desktop alerts.");
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") return toast.error("Alerts are blocked for this site in the browser settings.");
    try {
      localStorage.setItem("todo-alerts", "on");
    } catch {}
    setAlerts(true);
    toast.success("Desktop alerts on for urgent items, while the app is open in a tab.");
  };

  const count = data?.count || 0;
  const urgent = data?.urgent || 0;
  const Icon = urgent ? BellRing : Bell;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={count ? `To-do: ${count} item${count === 1 ? "" : "s"}${urgent ? `, ${urgent} urgent` : ""}` : "To-do: nothing waiting"}>
          <Icon className="size-5" />
          {count > 0 && (
            <span className={cn("absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums text-white", urgent ? "bg-destructive" : "bg-primary")}>
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-4 bg-gray-50 p-4 sm:max-w-md">
        <SheetHeader className="p-0 pr-8">
          <SheetTitle>To-do</SheetTitle>
          <SheetDescription>
            {count ? `${count} thing${count === 1 ? "" : "s"} need${count === 1 ? "s" : ""} you${urgent ? ` — ${urgent} urgent` : ""}.` : "Nothing needs you right now."}
            {data?.snoozed ? ` ${data.snoozed} put off for later.` : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="-mx-4 flex-1 overflow-y-auto px-4">
          {!data ? (
            <Loader2 className="mx-auto mt-8 size-5 animate-spin text-gray-400" />
          ) : data.items.length ? (
            <ul className="flex flex-col gap-2">
              {data.items.map((item) => (
                <Item key={item.key} item={item} onAct={act} busy={busy === item.key} onNavigate={() => setOpen(false)} />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg bg-white p-6 text-center text-sm text-gray-600 shadow-paper">All clear. The Focus check and autopilot add to this list as they find things.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 text-xs text-gray-600">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-primary" checked={alerts} onChange={toggleAlerts} />
            Desktop alerts for urgent items
          </label>
          <Link href="/focus" onClick={() => setOpen(false)} className="font-medium text-primary underline-offset-4 hover:underline">
            Full checklist
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
