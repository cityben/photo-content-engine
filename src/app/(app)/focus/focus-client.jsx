"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Circle, CircleDashed, Loader2, Play, Plus, RotateCcw, Sparkles, X, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { money } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

const IMPACT = { high: "destructive", medium: "default", low: "secondary" };
const EFFORT = { minutes: "minutes", hour: "an hour", "half-day": "half a day", "day+": "a day+" };
const when = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "");
const cost = (n) => (n > 0 ? money(n, 3) : "free");
const ago = (iso) => {
  if (!iso) return "never";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

function StatusIcon({ status }) {
  if (status === "running") return <Loader2 className="size-4 animate-spin text-primary" />;
  if (status === "ok") return <CheckCircle2 className="size-4 text-primary" />;
  if (status === "warn") return <AlertTriangle className="size-4 text-amber-600" />;
  if (status === "bad" || status === "error") return <XCircle className="size-4 text-destructive" />;
  if (status === "skipped") return <CircleDashed className="size-4 text-gray-400" />;
  return <Circle className="size-4 text-gray-300" />;
}

function Score({ value }) {
  const tone = value >= 80 ? "text-primary" : value >= 55 ? "text-amber-600" : "text-destructive";
  return (
    <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-full bg-gray-50">
      <span className={cn("text-2xl font-bold tabular-nums", tone)}>{value}</span>
      <span className="text-[11px] text-gray-500">of 100</span>
    </div>
  );
}

/* --- Latest brief -------------------------------------------------------- */

function Brief({ run }) {
  const [open, setOpen] = useState(false);
  if (!run?.brief) {
    return (
      <section className="rounded-xl bg-white p-5 shadow-paper">
        <h2 className="text-base font-semibold text-gray-900">No growth check yet</h2>
        <p className="mt-1 text-sm text-gray-600">Pick checks below and press Run. The free ones take under a minute and cost nothing.</p>
      </section>
    );
  }
  const b = run.brief;
  return (
    <section aria-labelledby="brief-title" className="flex min-w-0 flex-col gap-5 rounded-xl bg-white p-5 shadow-paper">
      <div className="flex flex-wrap items-start gap-5">
        <Score value={b.score} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-xs text-gray-500">
            {run.trigger === "schedule" ? "Weekly run" : "Run"} {when(run.finishedAt || run.createdAt)} · {run.checks.length} checks · {run.findingsCount} findings · {cost((run.cost || 0) + (run.aiCost || 0))}
            {run.briefRun?.model ? ` · brief by ${run.briefRun.model}` : " · brief by rules"}
          </p>
          <h2 id="brief-title" className="text-lg font-semibold leading-7 text-gray-900">
            {b.headline}
          </h2>
          <p className="max-w-[75ch] text-sm leading-6 text-gray-700">{b.summary}</p>
          {run.briefError && <p className="text-xs text-gray-500">AI brief unavailable ({run.briefError}) — built by rules instead.</p>}
        </div>
      </div>
      {b.focus?.length > 0 && (
        <ol className="grid gap-3 md:grid-cols-3">
          {b.focus.map((x, i) => (
            <li key={x.title} className="flex flex-col gap-1 rounded-lg bg-gray-50 p-4">
              <span className="text-xs font-semibold text-primary">Focus {i + 1}</span>
              <span className="text-sm font-semibold text-gray-900">{x.title}</span>
              <span className="text-xs leading-5 text-gray-600">{x.why}</span>
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-fit items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900" aria-expanded={open}>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} /> Check by check
      </button>
      {open && (
        <ul className="flex flex-col gap-2">
          {run.checks.map((id) => {
            const r = run.results[id];
            if (!r) return null;
            return (
              <li key={id} className="flex items-start gap-2 text-sm">
                <StatusIcon status={r.status} />
                <span className="min-w-0">
                  <span className="font-medium text-gray-900">{r.label}</span> <span className="text-gray-600">— {r.headline}</span>
                  {r.cost ? <span className="text-xs text-gray-500"> · {money(r.cost, 3)}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* --- Checklist ----------------------------------------------------------- */

function Checklist({ initial }) {
  const [list, setList] = useState(initial);
  const [view, setView] = useState("open");
  const [draft, setDraft] = useState("");
  const counts = { open: list.filter((i) => i.status === "open").length, done: list.filter((i) => i.status === "done").length };
  const order = { high: 0, medium: 1, low: 2 };
  const shown = list.filter((i) => (view === "all" ? i.status !== "dismissed" : i.status === view)).sort((a, b) => order[a.impact] - order[b.impact] || (a.lastSeen < b.lastSeen ? 1 : -1));

  const set = async (item, status) => {
    setList((l) => l.map((i) => (i.id === item.id ? { ...i, status } : i)));
    try {
      const { item: saved } = await api(`/api/agent/checklist/${item.id}`, { method: "PATCH", body: { status } });
      setList((l) => l.map((i) => (i.id === item.id ? saved : i)));
    } catch (e) {
      setList((l) => l.map((i) => (i.id === item.id ? item : i)));
      toast.error(e.message);
    }
  };

  const total = counts.open + counts.done;
  return (
    <section aria-labelledby="checklist-title" className="flex min-w-0 flex-col gap-4 rounded-xl bg-white p-5 shadow-paper">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="checklist-title" className="text-base font-semibold text-gray-900">
            Checklist
          </h2>
          <p className="text-xs text-gray-600">
            {counts.done} of {total} done. Items carry over between runs; a ticked item that comes back is reopened.
          </p>
        </div>
        <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Show">
          {[
            ["open", `To do (${counts.open})`],
            ["done", `Done (${counts.done})`],
            ["all", "All"],
          ].map(([id, text]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={cn("rounded-md px-3 py-1 text-sm font-medium", view === id ? "bg-white shadow-paper" : "text-gray-600 hover:text-gray-900")}>
              {text}
            </button>
          ))}
        </div>
      </div>
      {total > 0 && (
        <span className="block h-2 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden>
          <span className="block h-full rounded-full bg-marker" style={{ width: `${(counts.done / total) * 100}%` }} />
        </span>
      )}
      {shown.length ? (
        <ul className="flex flex-col gap-2">
          {shown.map((i) => (
            <li key={i.id} className={cn("flex items-start gap-3 rounded-lg bg-gray-50 p-3", i.status === "done" && "opacity-60")}>
              <input type="checkbox" checked={i.status === "done"} onChange={(e) => set(i, e.target.checked ? "done" : "open")} aria-label={`Mark “${i.title}” done`} className="mt-0.5 size-4 shrink-0 accent-[#003157]" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className={cn("text-sm font-medium text-gray-900", i.status === "done" && "line-through")}>{i.title}</p>
                {i.why && <p className="text-xs leading-5 text-gray-600">{i.why}</p>}
                <div className="flex flex-wrap items-center gap-1.5">
                  {i.impact && <Badge variant={IMPACT[i.impact]}>{i.impact} impact</Badge>}
                  {i.effort && <Badge variant="secondary">{EFFORT[i.effort] || i.effort}</Badge>}
                  {i.recurred && <Badge variant="destructive">back again</Badge>}
                  {i.manual && <Badge variant="secondary">added by hand</Badge>}
                  {i.status === "done" && i.doneBy && <span className="text-xs text-gray-500">done by {i.doneBy} {ago(i.doneAt)}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {i.href && i.status !== "done" && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={i.href}>
                      Go <ArrowRight />
                    </Link>
                  </Button>
                )}
                {i.status !== "dismissed" ? (
                  <Button size="icon-sm" variant="ghost" onClick={() => set(i, "dismissed")} aria-label={`Dismiss “${i.title}”`} title="Not relevant">
                    <X />
                  </Button>
                ) : (
                  <Button size="icon-sm" variant="ghost" onClick={() => set(i, "open")} aria-label="Restore">
                    <RotateCcw />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">{view === "open" ? (total ? "All done. Run the check again to see what's next." : "Run a check to build your list.") : "Nothing here."}</p>
      )}
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const { item } = await api("/api/agent/checklist", { method: "POST", body: { title: draft } });
            setList((l) => [item, ...l]);
            setDraft("");
          } catch (err) {
            toast.error(err.message);
          }
        }}
      >
        <Input aria-label="Add your own item" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add your own item, e.g. Ask Acme FM for a testimonial" />
        <Button type="submit" variant="outline" disabled={draft.trim().length < 3}>
          <Plus /> Add
        </Button>
      </form>
    </section>
  );
}

/* --- Run ------------------------------------------------------------------ */

function RunPanel({ catalogue, onDone }) {
  const { checks, ai, budget, presets } = catalogue;
  const [picked, setPicked] = useState(() => presets.free.checks);
  const [useAi, setUseAi] = useState(ai.available);
  const [progress, setProgress] = useState(null); // { [id]: { status, headline, findings } }
  const running = progress && Object.values(progress).some((p) => p.status === "running" || p.status === "queued");

  const total = useMemo(() => checks.filter((c) => picked.includes(c.id)).reduce((s, c) => s + (c.estimate || 0), 0) + (useAi && ai.estimate ? ai.estimate : 0), [checks, picked, useAi, ai.estimate]);
  const paidTotal = checks.filter((c) => picked.includes(c.id) && c.group === "paid").reduce((s, c) => s + (c.estimate || 0), 0);
  const overBudget = budget?.left != null && paidTotal > budget.left;

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const preset = (key) => setPicked(presets[key].checks.filter((id) => checks.find((c) => c.id === id)?.available));

  const start = async () => {
    try {
      const { run } = await api("/api/agent/runs", { method: "POST", body: { checks: picked, useAi } });
      const state = Object.fromEntries(run.checks.map((id) => [id, { status: "queued" }]));
      setProgress({ ...state });
      for (const id of run.checks) {
        setProgress((p) => ({ ...p, [id]: { status: "running" } }));
        try {
          const { result } = await api(`/api/agent/runs/${run.id}/checks/${id}`, { method: "POST" });
          setProgress((p) => ({ ...p, [id]: result }));
        } catch (e) {
          setProgress((p) => ({ ...p, [id]: { status: "error", headline: e.message } }));
        }
      }
      setProgress((p) => ({ ...p, __brief: { status: "running" } }));
      const { run: done } = await api(`/api/agent/runs/${run.id}/finish`, { method: "POST" });
      setProgress(null);
      toast.success(`Done: ${done.findingsCount} findings · score ${done.brief.score}`);
      onDone();
    } catch (e) {
      toast.error(e.message);
      setProgress(null);
    }
  };

  const Group = ({ title, group, note }) => (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold text-gray-900">{title}</legend>
      {note && <p className="-mt-1 text-xs text-gray-500">{note}</p>}
      <ul className="flex flex-col gap-1.5">
        {checks
          .filter((c) => c.group === group)
          .map((c) => {
            const p = progress?.[c.id];
            return (
              <li key={c.id}>
                <label className={cn("flex items-start gap-3 rounded-lg p-2.5", c.available ? "cursor-pointer hover:bg-gray-50" : "opacity-50")}>
                  {p ? <StatusIcon status={p.status} /> : <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} disabled={!c.available || running} className="mt-0.5 size-4 accent-[#003157]" />}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-medium text-gray-900">
                      {c.label}
                      <span className="text-xs font-normal tabular-nums text-gray-500">{c.group === "free" ? "free" : c.estimate == null ? "connect DataForSEO" : `≈ ${money(c.estimate, 3)}`}</span>
                    </span>
                    <span className="text-xs text-gray-600">{p?.headline || c.description}</span>
                    {!p && <span className="text-[11px] text-gray-400">last run {ago(c.lastRun)}</span>}
                  </span>
                </label>
              </li>
            );
          })}
      </ul>
    </fieldset>
  );

  return (
    <section aria-labelledby="run-title" className="flex min-w-0 flex-col gap-4 rounded-xl bg-white p-5 shadow-paper">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="run-title" className="text-base font-semibold text-gray-900">
          Run a check
        </h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Presets">
          {Object.entries(presets).map(([key, p]) => (
            <Button key={key} size="sm" variant="outline" onClick={() => preset(key)} disabled={running}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-6">
        <Group title="Free checks" group="free" note="Read data the tool already has. Seconds, no cost." />
        <div className="flex flex-col gap-6">
          <Group title="Paid data refreshes (DataForSEO)" group="paid" note="Run first, so the review reads fresh data. Estimates use your last real cost where there is one." />
          <label className={cn("flex items-start gap-3 rounded-lg bg-gray-50 p-3", !ai.available && "opacity-50")}>
            {progress?.__brief ? <StatusIcon status="running" /> : <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} disabled={!ai.available || running} className="mt-0.5 size-4 accent-[#003157]" />}
            <span className="flex flex-col">
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                <Sparkles className="size-3.5 text-primary" /> AI focus brief {ai.estimate != null && <span className="text-xs font-normal text-gray-500">≈ {money(ai.estimate, 3)}</span>}
              </span>
              <span className="text-xs text-gray-600">{ai.available ? `${ai.model} reads every finding and picks the three things that matter most. Off: ranked by rules.` : "Connect the AI Gateway to use it. Rules rank the findings meanwhile."}</span>
            </span>
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary-soft p-4">
        <div className="text-sm text-gray-900">
          <p className="font-semibold">
            {picked.length} check{picked.length === 1 ? "" : "s"} · {total > 0 ? `estimated ${money(total, 3)}` : "free"}
          </p>
          <p className="text-xs text-gray-700">
            {budget ? `DataForSEO this month: ${money(budget.spent ?? 0)} of ${money(budget.budget)} — ${money(budget.left ?? 0)} left.` : "DataForSEO not connected — paid refreshes are unavailable."}
            {overBudget && <span className="font-medium text-destructive"> Over this month&apos;s budget — some refreshes will stop.</span>}
          </p>
        </div>
        <Button onClick={start} disabled={running || !picked.length}>
          {running ? <Loader2 className="animate-spin" /> : <Play />} {running ? "Running… keep this page open" : "Run"}
        </Button>
      </div>
    </section>
  );
}

/* --- Automation & history ------------------------------------------------ */

function Automation({ initial, presets, cronReady }) {
  const [s, setS] = useState(initial);
  const save = async (next) => {
    const prev = s;
    setS(next);
    try {
      const { schedule } = await api("/api/agent/schedule", { method: "PUT", body: next });
      setS(schedule);
      toast.success(schedule.enabled ? "Weekly growth check on." : "Weekly growth check off.");
    } catch (e) {
      setS(prev);
      toast.error(e.message);
    }
  };
  return (
    <section aria-labelledby="auto-title" className="flex min-w-0 flex-col gap-3 rounded-xl bg-white p-5 shadow-paper">
      <h2 id="auto-title" className="text-base font-semibold text-gray-900">
        Run it automatically
      </h2>
      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input type="checkbox" checked={s.enabled} onChange={(e) => save({ ...s, enabled: e.target.checked })} className="size-4 accent-[#003157]" />
        Every Monday at 06:30 (UTC), ready when you start the week
      </label>
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
        <select value={s.preset} onChange={(e) => save({ ...s, preset: e.target.value })} aria-label="Checks to run" className="h-9 rounded-md bg-gray-100 px-3 text-sm">
          {Object.entries(presets).map(([k, p]) => (
            <option key={k} value={k}>
              {p.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.useAi} onChange={(e) => save({ ...s, useAi: e.target.checked })} className="size-4 accent-[#003157]" /> AI brief
        </label>
      </div>
      {!cronReady && <p className="rounded-md bg-gray-50 p-3 text-xs text-gray-700">Add a <code className="font-mono">CRON_SECRET</code> environment variable in Vercel (any long random string) and redeploy — Vercel sends it with each scheduled run so nobody else can trigger it.</p>}
    </section>
  );
}

function History({ runs }) {
  if (!runs.length) return null;
  return (
    <section aria-labelledby="history-title" className="flex min-w-0 flex-col gap-3 rounded-xl bg-white p-5 shadow-paper">
      <h2 id="history-title" className="text-base font-semibold text-gray-900">
        Past runs
      </h2>
      <ul className="flex flex-col divide-y divide-gray-100 text-sm">
        {runs.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-gray-800">
              {when(r.createdAt)} · {r.trigger === "schedule" ? "weekly" : "manual"} · {r.checks.length} checks
            </span>
            <span className="flex items-center gap-3 text-xs tabular-nums text-gray-600">
              {r.status === "done" ? (
                <>
                  <span className="font-semibold text-gray-900">score {r.brief?.score}</span>
                  <span>{r.findingsCount} findings</span>
                  <span>{cost((r.cost || 0) + (r.aiCost || 0))}</span>
                </>
              ) : (
                <span>{r.status === "running" ? "didn't finish" : r.status}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FocusClient({ data, cronReady }) {
  const router = useRouter();
  const latest = data.runs.find((r) => r.status === "done");
  return (
    <div className="flex flex-col gap-6">
      <Brief run={latest} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Checklist key={data.checklist.map((i) => `${i.id}${i.status}`).join()} initial={data.checklist} />
        <RunPanel catalogue={data} onDone={() => router.refresh()} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Automation initial={data.schedule} presets={data.presets} cronReady={cronReady} />
        <History runs={data.runs} />
      </div>
    </div>
  );
}
