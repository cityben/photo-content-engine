"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Loader2, Target } from "lucide-react";

import { ChannelChip } from "@/components/post-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import { zonedToDate } from "@/lib/time";
import { serviceInfo } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

const PERIODS = [
  ["today", "Today"],
  ["week", "Week"],
  ["month", "Month"],
  ["year", "Year"],
];

const STATUS = {
  covered: { label: "Covered", variant: "success" },
  "on-track": { label: "On track", variant: "default" },
  behind: { label: "Behind", variant: "destructive" },
  rest: { label: "Rest day", variant: "secondary" },
};

const DOT = { high: "bg-destructive", medium: "bg-amber-500", low: "bg-gray-400" };

/** One line that sums up the period across channels. */
function headline(services, period, label) {
  const rows = services.map((s) => ({ s, p: s.periods[period] }));
  const active = rows.filter((r) => r.p.target > 0);
  if (!active.length) return period === "today" ? "Rest day — no posting targets today." : `No posting days ${label.toLowerCase()}.`;
  const target = active.reduce((n, r) => n + r.p.target, 0);
  const covered = active.reduce((n, r) => n + Math.min(r.p.target, r.p.covered), 0);
  const behind = active.filter((r) => r.p.behind > 0);
  const lead = `${covered} of ${target} posts ${period === "year" || period === "month" ? "published or booked" : "covered"}`;
  if (behind.length) return `${lead}. Behind on ${behind.map((r) => `${serviceInfo(r.s.service).label} (${r.p.behind})`).join(" and ")}.`;
  if (covered >= target) return `${lead}. Every target ${period === "today" ? "for today" : label.toLowerCase()} is met.`;
  return `${lead}. On track — ${target - covered} still to book.`;
}

function Bar({ p }) {
  const max = Math.max(p.target, p.covered, 1);
  const pct = (n) => `${Math.min(100, (n / max) * 100)}%`;
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden>
      <span className="absolute inset-y-0 left-0 bg-primary" style={{ width: pct(p.sent) }} />
      <span className="absolute inset-y-0 bg-primary/40" style={{ left: pct(p.sent), width: pct(p.booked) }} />
      {p.target > 0 && p.target < max && <span className="absolute inset-y-0 w-0.5 bg-gray-900" style={{ left: pct(p.target) }} />}
    </div>
  );
}

function ServiceRow({ s, period }) {
  const p = s.periods[period];
  const status = STATUS[p.status];
  return (
    <li className="grid gap-2 sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:gap-4">
      <ChannelChip service={s.service} className="w-fit" />
      <div className="flex min-w-0 flex-col gap-1">
        <Bar p={p} />
        <p className="text-xs tabular-nums text-gray-600">
          {p.sent} published · {p.booked} booked · target {p.target}
          {period === "year" && p.target > 0 && s.hitRate != null && ` · on pace for ${s.projected}`}
          {period !== "year" && s.streak > 1 && ` · ${s.streak} posting days met in a row`}
          {p.failed > 0 && <span className="text-destructive"> · {p.failed} failed</span>}
        </p>
      </div>
      <Badge variant={status.variant} className="w-fit">
        {p.status === "behind" ? `Behind ${p.behind}` : status.label}
      </Badge>
    </li>
  );
}

function ActionButton({ a, onSchedule, busy }) {
  if (a.kind === "schedule" && onSchedule) {
    return (
      <Button size="sm" className="h-auto min-h-8 whitespace-normal text-left" onClick={() => onSchedule(a.item, a.when ? zonedToDate(a.when).toISOString() : undefined)} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <CalendarCheck />} {a.cta}
        {a.when ? ` · ${a.when.slice(11)}` : ""}
      </Button>
    );
  }
  const href = a.kind === "schedule" ? "/calendar" : a.kind === "approve" ? `/jobs/${a.jobId}` : a.kind === "idea" ? `/jobs/new?idea=${a.ideaId}` : a.kind === "new" ? "/jobs/new" : null;
  if (!href) return null;
  return (
    <Button size="sm" variant="outline" className="h-auto min-h-8 whitespace-normal text-left" asChild>
      <Link href={href}>
        {a.cta} <ArrowRight />
      </Link>
    </Button>
  );
}

/**
 * Posting targets from the publishing schedule: progress for today, the
 * week, the month and the year, and what to do next. `reloadKey` refetches;
 * `onSchedule(item, dueAt)` books an approved post in place (calendar).
 */
export function TargetsPanel({ reloadKey = 0, onSchedule, busyKey, compact = false, initialPeriod = "today" }) {
  const [period, setPeriod] = useState(initialPeriod);
  const [state, setState] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    api("/api/calendar/targets")
      .then(({ targets }) => !cancelled && setState({ key: reloadKey, data: targets, error: null }))
      .catch((e) => !cancelled && setState((s) => ({ ...s, key: reloadKey, error: e.message })));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const data = state.data;
  const label = data?.periods[period]?.label || "";
  const actions = data?.actions || [];

  return (
    <section aria-labelledby="targets-title" className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-paper sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="targets-title" className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <Target className="size-4 text-primary" /> Posting targets
        </h2>
        <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Period">
          {PERIODS.map(([id, text]) => (
            <button
              key={id}
              type="button"
              aria-pressed={period === id}
              onClick={() => setPeriod(id)}
              className={cn("rounded-md px-3 py-1 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring", period === id ? "bg-white shadow-paper" : "text-gray-600 hover:text-gray-900")}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {!data && !state.error && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Checking targets…
        </p>
      )}
      {state.error && !data && <p className="text-sm text-destructive">Couldn&apos;t load targets: {state.error}</p>}

      {data && (
        <>
          <p className="text-sm font-medium text-gray-900">
            {label}: {headline(data.services, period, label)}
          </p>
          <ul className="flex flex-col gap-3">
            {data.services.map((s) => (
              <ServiceRow key={s.service} s={s} period={period} />
            ))}
          </ul>
          {actions.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Do next</p>
              <ol className="flex flex-col gap-2">
                {actions.slice(0, compact ? 3 : 6).map((a) => (
                  <li key={a.id} className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 gap-2.5">
                      <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[a.severity])} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{a.title}</p>
                        <p className="text-xs leading-5 text-gray-600">{a.detail}</p>
                      </div>
                    </div>
                    <div className="min-w-0 sm:shrink-0">
                      <ActionButton a={a} onSchedule={onSchedule} busy={busyKey === (a.item && `${a.item.jobId}:${a.item.service}`)} />
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="rounded-lg bg-marker-soft p-3 text-sm text-gray-800">Nothing to chase — every posting day ahead is booked.</p>
          )}
          <p className="text-xs text-gray-500">
            Targets come from Publishing days (days, times and posts per day){data.since ? `, counted from ${new Date(`${data.since}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}. Published = Buffer says it went out; booked = scheduled.
          </p>
        </>
      )}
    </section>
  );
}
