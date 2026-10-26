"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import { formatNumber } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

/**
 * Headline number with its change vs the previous period. `better` says
 * which way is good (average position: lower is better). The change is
 * written out in ink; the arrow carries direction, its colour says good/bad.
 */
export function KpiTile({ label, value, change, better = "up", hint, href }) {
  const good = change == null || change === 0 ? null : better === "up" ? change > 0 : change < 0;
  const Arrow = change > 0 ? ArrowUpRight : ArrowDownRight;
  const body = (
    <>
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-2xl font-bold tabular-nums text-gray-900">{value}</span>
      <span className="flex min-h-4 items-center gap-1 text-xs text-gray-600">
        {change != null && change !== 0 && (
          <>
            <Arrow aria-hidden className={cn("size-3.5", good ? "text-primary" : "text-destructive")} />
            <span className="tabular-nums">
              {change > 0 ? "+" : ""}
              {Math.abs(change) >= 100 ? Math.round(change) : change.toFixed(1)}%
            </span>
            <span className="sr-only">{good ? "(better)" : "(worse)"}</span>
            <span className="text-gray-500">vs previous 28 days</span>
          </>
        )}
        {(change == null || change === 0) && hint && <span className="text-gray-500">{hint}</span>}
      </span>
    </>
  );
  const cls = "flex min-w-0 flex-col gap-1 rounded-xl bg-white p-4 shadow-paper";
  return href ? (
    <Link href={href} className={cn(cls, "outline-none transition-shadow hover:shadow-paper-lg focus-visible:ring-[3px] focus-visible:ring-ring")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A small single-series trend line; the numbers it shows are in the table beside it. */
export function Sparkline({ values = [], label, width = 96, height = 28 }) {
  const points = values.filter((v) => Number.isFinite(v));
  if (points.length < 2) return <span className="text-xs text-gray-400">—</span>;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = (width - 4) / (points.length - 1);
  const xy = points.map((v, i) => [2 + i * step, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy.at(-1);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="overflow-visible">
      <title>{`${label}: ${points.map((v) => formatNumber(v)).join(" → ")}`}</title>
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.5" fill="var(--primary)" />
    </svg>
  );
}

/** Horizontal bar for a share (0–1), labelled in text beside it. */
export function ShareBar({ value, you }) {
  if (value == null) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
        <span className={cn("block h-full rounded-full", you ? "bg-primary" : "bg-gray-400")} style={{ width: `${Math.max(2, value * 100)}%` }} />
      </span>
      <span className="text-xs tabular-nums text-gray-700">{Math.round(value * 100)}%</span>
    </span>
  );
}

/** One click: put a search into the content pipeline (or open it if it's there). */
export function AddToPipeline({ keyword, volume, inPipeline }) {
  const [added, setAdded] = useState(inPipeline);
  const [busy, setBusy] = useState(false);
  if (added) {
    return (
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
        <Link href={added.jobId ? `/jobs/${added.jobId}` : "/ideas"}>{added.jobId ? "Open draft" : "In pipeline"}</Link>
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 px-2 text-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { idea } = await api("/api/ideas", {
            method: "POST",
            body: { title: `Rank for “${keyword}”`, keyword, volume: volume ?? null, format: "article", source: "gap", sourceDetail: "From the dashboard's ranking gaps" },
          });
          setAdded({ id: idea.id, jobId: idea.jobId || null });
          toast.success("Added to the content pipeline — autopilot can draft it.");
        } catch (e) {
          toast.error(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Plus />} Pipeline
    </Button>
  );
}
