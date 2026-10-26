"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCw, X } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/client-api";
import { formatNumber } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

const PALETTE = ["#003157", "#0369a1", "#e11d48", "#15803d", "#a16207", "#7c3aed", "#0f766e", "#be185d"];

/** Fetch fresh data from DataForSEO (costs money) and reload the page. */
export function RefreshButton({ section, domain, keywords, label = "Refresh", variant = "outline", disabled }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await api("/api/market/refresh", { method: "POST", body: { section, ...(domain && { domain }), ...(keywords && { keywords }) } });
      if (r.pending) toast.success(`Requested · cost $${(r.cost || 0).toFixed(3)}. Results usually arrive in 1–5 minutes; this page checks for you.`);
      else toast.success(`Updated${r.rows != null ? ` · ${r.rows} rows` : ""} · cost $${(r.cost || 0).toFixed(3)}`);
      router.refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant={variant} onClick={run} disabled={busy || disabled} title="Fetches fresh data from DataForSEO (a few cents)">
      {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} {busy ? "Fetching…" : label}
    </Button>
  );
}

/** Edit the tracked competitor list (or seeds) — saved to market settings. */
export function ListEditor({ field, values, placeholder, label, max = 15 }) {
  const router = useRouter();
  const [items, setItems] = useState(values);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (next) => {
    setBusy(true);
    try {
      const { settings } = await api("/api/market/settings", { method: "PUT", body: { [field]: next } });
      setItems(settings[field]);
      router.refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-800 shadow-paper">
            {v}
            <button type="button" onClick={() => save(items.filter((x) => x !== v))} disabled={busy} aria-label={`Remove ${v}`} className="text-gray-500 hover:text-gray-900">
              <X className="size-3" />
            </button>
          </span>
        ))}
        {!items.length && <span className="text-xs text-gray-500">None yet.</span>}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) save([...items, draft.trim()]).then(() => setDraft(""));
        }}
      >
        <Input aria-label={label} placeholder={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} className="h-9 bg-white" />
        <Button type="submit" size="sm" variant="outline" disabled={busy || !draft.trim() || items.length >= max}>
          <Plus /> Add
        </Button>
      </form>
    </div>
  );
}

export function TrackButton({ domain, tracked }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy || tracked.includes(domain)}
      onClick={async () => {
        setBusy(true);
        try {
          await api("/api/market/settings", { method: "PUT", body: { competitors: [...tracked, domain] } });
          toast.success(`Tracking ${domain}. Refresh visibility to include it.`);
          router.refresh();
        } catch (e) {
          toast.error(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {tracked.includes(domain) ? "Tracked" : "Track"}
    </Button>
  );
}

function Spark({ values }) {
  if (!values?.length) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 48},${14 - (v / max) * 12}`).join(" ");
  return (
    <svg width="48" height="16" aria-hidden className="text-primary">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function Difficulty({ value }) {
  if (value == null) return <span className="text-gray-400">—</span>;
  const tone = value < 30 ? "bg-green-600" : value < 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-gray-100">
        <span className={cn("block h-full", tone)} style={{ width: `${value}%` }} />
      </span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

/**
 * Extra columns are declarative ({ key, label, kind, sort }) because a
 * server page can't hand render functions to a client component.
 */
function ExtraCell({ kind, value, row }) {
  if (value == null || value === "") return <span className="text-gray-400">—</span>;
  if (kind === "position") {
    return (
      <span className="inline-flex items-center gap-1 tabular-nums">
        {value}
        {row.change === "up" && <span className="text-xs text-green-700" title="Moved up">▲</span>}
        {row.change === "down" && <span className="text-xs text-destructive" title="Moved down">▼</span>}
        {row.change === "new" && <Badge variant="secondary">new</Badge>}
      </span>
    );
  }
  if (kind === "url") {
    let path = value;
    try {
      path = new URL(value).pathname;
    } catch {}
    return (
      <a href={value} target="_blank" rel="noreferrer" className="block max-w-56 truncate text-xs text-primary hover:underline" title={value}>
        {path}
      </a>
    );
  }
  if (kind === "number") return <span className="tabular-nums">{formatNumber(value)}</span>;
  return <span>{String(value)}</span>;
}

/** Sortable, filterable keyword table (ideas, gaps, ranked keywords). */
export function KeywordTable({ rows, extra = [], initialSort = "score", emptyText = "No data yet — press Refresh." }) {
  const [q, setQ] = useState("");
  const [minVolume, setMinVolume] = useState(0);
  const [maxDifficulty, setMaxDifficulty] = useState(100);
  const [intent, setIntent] = useState("all");
  const [trending, setTrending] = useState(false);
  const [sort, setSort] = useState(initialSort);

  const filtered = useMemo(() => {
    const list = rows.filter(
      (r) =>
        (!q || r.keyword.includes(q.toLowerCase())) &&
        r.volume >= minVolume &&
        (r.difficulty ?? 0) <= maxDifficulty &&
        (intent === "all" || (intent === "buying" ? ["commercial", "transactional"].includes(r.intent) : r.intent === intent)) &&
        (!trending || (r.trend ?? 0) > 10)
    );
    const ascending = ["difficulty", "position", "ourPosition", "theirPosition"].includes(sort);
    return list.sort((a, b) => (ascending ? (a[sort] ?? 999) - (b[sort] ?? 999) : (b[sort] ?? -1) - (a[sort] ?? -1)));
  }, [rows, q, minVolume, maxDifficulty, intent, trending, sort]);

  if (!rows.length) return <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">{emptyText}</p>;

  const sortable = ["score", "volume", "trend", "difficulty", "cpc", ...extra.filter((e) => e.sort).map((e) => e.sort)];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="kw-q" className="text-xs">Contains</Label>
          <Input id="kw-q" className="h-8 w-40 bg-white" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. vrf" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="kw-min" className="text-xs">Min searches/mo</Label>
          <Input id="kw-min" type="number" min={0} className="h-8 w-28 bg-white" value={minVolume} onChange={(e) => setMinVolume(Number(e.target.value) || 0)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="kw-diff" className="text-xs">Max difficulty</Label>
          <Input id="kw-diff" type="number" min={0} max={100} className="h-8 w-24 bg-white" value={maxDifficulty} onChange={(e) => setMaxDifficulty(Number(e.target.value) || 0)} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-700">Intent</span>
          <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Intent">
            {[["all", "All"], ["buying", "Buying"], ["informational", "Research"]].map(([id, t]) => (
              <button key={id} type="button" aria-pressed={intent === id} onClick={() => setIntent(id)} className={cn("rounded-md px-2 py-0.5 text-xs font-medium", intent === id ? "bg-white shadow-paper" : "text-gray-600")}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
          <input type="checkbox" checked={trending} onChange={(e) => setTrending(e.target.checked)} className="size-4 accent-[#003157]" /> Rising only
        </label>
        <div className="ml-auto flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-700">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-8 rounded-md bg-white px-2 text-xs shadow-paper" aria-label="Sort by">
            {sortable.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-gray-500">{filtered.length} of {rows.length} keywords</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Keyword</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="text-right">Searches/mo</TableHead>
            <TableHead>Trend (12 mo)</TableHead>
            <TableHead>Difficulty</TableHead>
            <TableHead className="hidden text-right md:table-cell">CPC</TableHead>
            <TableHead className="hidden lg:table-cell">Intent</TableHead>
            {extra.map((e) => (
              <TableHead key={e.key} className={e.className}>
                {e.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.slice(0, 200).map((r) => (
            <TableRow key={r.keyword}>
              <TableCell className="font-medium text-gray-900">{r.keyword}</TableCell>
              <TableCell className="text-right">
                <span className={cn("inline-block min-w-8 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums", r.score >= 60 ? "bg-marker-soft text-green-800" : r.score >= 40 ? "bg-gray-100 text-gray-800" : "text-gray-500")}>{r.score}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(r.volume)}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5">
                  <Spark values={r.monthly} />
                  {r.trend != null && <span className={cn("text-xs tabular-nums", r.trend > 10 ? "text-green-700" : r.trend < -10 ? "text-destructive" : "text-gray-500")}>{r.trend > 0 ? "+" : ""}{r.trend}%</span>}
                </span>
              </TableCell>
              <TableCell>
                <Difficulty value={r.difficulty} />
              </TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{r.cpc ? `$${r.cpc.toFixed(2)}` : "—"}</TableCell>
              <TableCell className="hidden lg:table-cell">{r.intent && <Badge variant={["commercial", "transactional"].includes(r.intent) ? "default" : "secondary"}>{r.intent}</Badge>}</TableCell>
              {extra.map((e) => (
                <TableCell key={e.key} className={e.className}>
                  <ExtraCell kind={e.kind} value={r[e.key]} row={r} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Lines over time: data [{ date, a: 1, b: 2 }], series ["a","b"]. */
export function LinesChart({ data, series, height = 260 }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b7280" }} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b7280" }} width={44} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 8px 24px -12px rgba(0,49,87,.25)", fontSize: 12 }} />
          {series.map((s, i) => (
            <Line key={s} type="monotone" dataKey={s} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
        {series.map((s, i) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /> {s}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TrendsForm({ initial }) {
  const [value, setValue] = useState(initial.join(", "));
  const keywords = value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1">
        <Label htmlFor="trend-kw">Up to 5 keywords, comma-separated</Label>
        <Input id="trend-kw" value={value} onChange={(e) => setValue(e.target.value)} placeholder="air conditioning, heat pump, vrf" />
      </div>
      <RefreshButton section="trends" keywords={keywords} label="Compare" variant="default" disabled={!keywords.length} />
    </div>
  );
}

/** Polls queued DataForSEO tasks (reviews) every 20s while any are pending. */
export function TaskWatcher({ count }) {
  const router = useRouter();
  useEffect(() => {
    if (!count) return;
    let stopped = false;
    let tries = 0;
    const tick = async () => {
      if (stopped || tries++ > 30) return;
      try {
        const r = await api("/api/market/refresh", { method: "POST", body: { section: "collect" } });
        if (r.done) {
          toast.success(`${r.done} review ${r.done === 1 ? "set" : "sets"} ready.`);
          router.refresh();
          return;
        }
      } catch {}
      timer = setTimeout(tick, 20000);
    };
    let timer = setTimeout(tick, 5000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [count, router]);
  if (!count) return null;
  return (
    <p role="status" className="flex items-center gap-2 rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary">
      <Loader2 className="size-4 animate-spin" /> {count} review {count === 1 ? "request" : "requests"} in DataForSEO&apos;s queue — checking every 20 seconds.
    </p>
  );
}

/** One text value in market settings (brand name, Google Maps area). */
export function TextSetting({ field, value, label, hint }) {
  const router = useRouter();
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const id = `setting-${field}`;
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/api/market/settings", { method: "PUT", body: { [field]: draft } });
          toast.success("Saved.");
          router.refresh();
        } catch (err) {
          toast.error(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="flex gap-2">
        <Input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} className="h-9 bg-white" />
        <Button type="submit" size="sm" variant="outline" disabled={busy || draft.trim() === value || draft.trim().length < 2}>
          Save
        </Button>
      </div>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </form>
  );
}
