"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, Check, CheckCircle2, ChevronDown, Copy, Globe, Inbox, Loader2, PenLine, Play, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { useCopy } from "@/components/use-copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import { formatNumber, money } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

const FORMAT_LABEL = { blog: "Blog post", linkedin: "LinkedIn post", googleBusiness: "Google Business post" };
const SECTION_CHIP = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  blog: "Blog post",
  caseStudy: "Case study",
  googleBusiness: "Google Business",
};
const when = (iso) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const selectClass = "h-8 rounded-md bg-gray-100 px-2 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring";

/* --- Autopilot ----------------------------------------------------------- */

function AutopilotPanel({ autopilot, onRan }) {
  const router = useRouter();
  const [config, setConfig] = useState(autopilot.config);
  const [estimate, setEstimate] = useState(autopilot.estimate);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const last = autopilot.runs[0];
  const next = autopilot.next.slice(0, config.perRun);

  const save = async (patch) => {
    const value = { ...config, ...patch };
    setConfig(value);
    setSaving(true);
    try {
      const r = await api("/api/autopilot", { method: "PUT", body: value });
      setConfig(r.config);
      setEstimate(r.estimate);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    setRunning(true);
    try {
      const { run: done } = await api("/api/autopilot/run", { method: "POST", body: {} });
      const ok = done.drafts.filter((d) => !d.error).length;
      const failed = done.drafts.filter((d) => d.error);
      if (done.note) toast.info(done.note);
      else toast.success(`${ok} draft${ok === 1 ? "" : "s"} ready to review${done.cost ? ` · ${money(done.cost, 3)}` : ""}.`);
      if (failed.length) toast.error(`${failed.length} couldn't be written: ${failed[0].error}`);
      if (done.planError) toast.error(`Planning skipped: ${done.planError}`);
      onRan(done);
      router.refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section aria-labelledby="autopilot-title" className="flex min-w-0 flex-col gap-4 rounded-xl bg-white p-5 shadow-paper">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="autopilot-title" className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Sparkles className="size-4 text-primary" /> Autopilot
          </h2>
          <p className="max-w-prose text-sm text-gray-600">
            Plans fresh ideas from your search, competitor and review data, then drafts the best open ideas as a blog post and posts each — written towards the idea&apos;s target search, never claiming work that didn&apos;t happen. They land here for you to approve.
          </p>
        </div>
        <Button onClick={run} disabled={running || !autopilot.aiReady}>
          {running ? <Loader2 className="animate-spin" /> : <Play />}
          {running ? "Drafting — a minute or two…" : `Run now${estimate?.total != null ? ` · ≈${money(estimate.total, 2)}` : ""}`}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-primary" checked={config.enabled} onChange={(e) => save({ enabled: e.target.checked })} disabled={saving} />
            Run every Monday at 08:00
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-primary" checked={config.plan} onChange={(e) => save({ plan: e.target.checked })} disabled={saving} />
            Plan new ideas first{estimate?.plan ? ` (≈${money(estimate.plan, 3)})` : ""}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-primary" checked={config.photos} onChange={(e) => save({ photos: e.target.checked })} disabled={saving} />
            Borrow a related photo from a past job for the blog header
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="ap-count">Draft</label>
            <select id="ap-count" className={selectClass} value={config.perRun} onChange={(e) => save({ perRun: Number(e.target.value) })} disabled={saving}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>ideas a run{estimate?.perDraft != null ? `, ≈${money(estimate.perDraft, 3)} each` : ""}, as:</span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="What to draft for each idea">
            {Object.entries(FORMAT_LABEL).map(([id, label]) => {
              const on = config.formats.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  disabled={saving || (on && config.formats.length === 1)}
                  onClick={() => save({ formats: on ? config.formats.filter((f) => f !== id) : [...config.formats, id] })}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring", on ? "bg-primary text-primary-foreground" : "bg-gray-100 text-gray-700")}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {!autopilot.aiReady && <p className="text-xs text-destructive">Connect the AI Gateway to use autopilot.</p>}
        </div>
        <div className="flex min-w-0 flex-col gap-2 rounded-lg bg-gray-50 p-3 text-sm">
          <p className="font-medium text-gray-900">Next up</p>
          {next.length ? (
            <ol className="flex flex-col gap-1.5">
              {next.map((i) => (
                <li key={i.id} className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-gray-800">{i.title}</span>
                  {i.keyword && <span className="shrink-0 text-xs text-gray-500">“{i.keyword}”{i.volume ? ` · ${formatNumber(i.volume)}/mo` : ""}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-gray-600">
              No open ideas it can draft. {config.plan ? "A run plans some first." : <Link href="/ideas" className="text-primary underline underline-offset-4">Add ideas</Link>}
            </p>
          )}
          {last && (
            <p className="mt-auto pt-2 text-xs text-gray-500">
              Last run {when(last.createdAt)} · {last.drafts?.filter((d) => !d.error).length || 0} drafted
              {last.planned ? ` · ${last.planned.added} ideas planned` : ""}
              {last.cost ? ` · ${money(last.cost, 3)}` : ""}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* --- Queue --------------------------------------------------------------- */

function ReviewCard({ item, channels, social, websiteConnected, onAction, busy }) {
  const { copied, copy } = useCopy();
  const [open, setOpen] = useState(false);
  const options = channels.filter((c) => c.service === item.section);
  const [channelId, setChannelId] = useState(options[0]?.id || "");
  const p = item.preview;
  const blocked = item.blockers.length > 0;
  const approving = item.state === "approve";
  const act = (action) => onAction(item, action, action === "schedule" ? channelId : undefined);

  let primary = null;
  if (item.next === "schedule") {
    const disabled = busy || blocked || !options.length || !social.postingEnabled;
    primary = (
      <>
        {options.length > 1 && (
          <select aria-label="Channel" className={selectClass} value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.organizationName ? ` · ${c.organizationName}` : ""}
              </option>
            ))}
          </select>
        )}
        <Button size="sm" onClick={() => act("schedule")} disabled={disabled} title={!options.length ? "No channel connected" : !social.postingEnabled ? "Posting is switched off" : "Into the next free slot"}>
          <CalendarClock /> {approving ? "Approve & schedule" : "Schedule"}
        </Button>
      </>
    );
  } else if (item.next === "send") {
    primary = (
      <Button size="sm" onClick={() => act("send")} disabled={busy || blocked || !websiteConnected} title={!websiteConnected ? "Connect the website in Settings" : "Created unpublished on the website"}>
        <Globe /> {approving ? "Approve & send draft" : "Send draft"}
      </Button>
    );
  } else if (item.next === "posted") {
    primary = approving ? (
      <Button size="sm" onClick={() => act("approve").then((ok) => ok && copy(p.text, "Approved and copied — paste it into Google Business."))} disabled={busy}>
        <Copy /> Approve & copy
      </Button>
    ) : (
      <>
        <Button size="sm" variant="outline" onClick={() => copy(p.text, "Copied")}>
          {copied ? <Check /> : <Copy />} Copy
        </Button>
        <Button size="sm" onClick={() => act("posted")} disabled={busy}>
          <CheckCircle2 /> Mark as posted
        </Button>
      </>
    );
  }

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl bg-white p-4 shadow-paper sm:p-5">
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{SECTION_CHIP[item.section]}</Badge>
            {item.state === "ready" && <Badge variant="success">Approved</Badge>}
            {item.idea && <Badge variant="secondary">{item.source === "autopilot" ? "Autopilot" : "From an idea"}</Badge>}
            {item.keyword && <span className="text-xs text-gray-500">targets “{item.keyword}”</span>}
          </div>
          <Link href={`/jobs/${item.jobId}?tab=${item.section}`} className="w-fit text-sm font-semibold text-gray-900 underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring">
            {p.title || item.jobTitle}
          </Link>
          {p.title && p.title !== item.jobTitle && <p className="-mt-1 text-xs text-gray-500">{item.jobTitle}</p>}
          <p className={cn("max-w-prose whitespace-pre-line text-sm leading-6 text-gray-700", !open && "line-clamp-5")}>{p.text || "(empty)"}</p>
          {open && p.body && <div className="max-w-prose whitespace-pre-line rounded-lg bg-gray-50 p-3 text-sm leading-6 text-gray-700">{p.body}</div>}
          {(p.body || (p.text && p.text.length > 320)) && (
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-fit items-center gap-1 text-xs font-medium text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
              <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} /> {open ? "Show less" : p.body ? "Read it all" : "Show all"}
            </button>
          )}
        </div>
        {item.image && (
          <div className="relative hidden size-24 shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:block">
            <Image src={item.image.url} alt={item.image.alt} fill unoptimized sizes="96px" className="object-cover" />
          </div>
        )}
      </div>
      {item.next === "send" && !websiteConnected && !blocked && <p className="text-xs text-gray-600">Connect the website in Settings to send drafts. You can still approve it now.</p>}
      {item.next === "schedule" && !options.length && <p className="text-xs text-gray-600">No {SECTION_CHIP[item.section]} channel is connected in Buffer.</p>}
      {blocked && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {item.blockers.join(" ")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {primary}
        {approving && item.next !== "posted" && (
          <Button size="sm" variant="outline" onClick={() => act("approve")} disabled={busy}>
            <Check /> Approve only
          </Button>
        )}
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/jobs/${item.jobId}?tab=${item.section}`}>
            <PenLine /> Edit
          </Link>
        </Button>
        {!approving && (
          <Button size="sm" variant="ghost" onClick={() => act("unapprove")} disabled={busy}>
            <Undo2 /> Unapprove
          </Button>
        )}
        {busy && <Loader2 className="size-4 animate-spin text-gray-500" aria-label="Working" />}
      </div>
    </li>
  );
}

export function ReviewClient({ initialItems, initialView, channels, social, websiteConnected, autopilot }) {
  const [items, setItems] = useState(initialItems);
  const [view, setView] = useState(initialView);
  const [type, setType] = useState("all");
  const [busy, setBusy] = useState(null);

  const counts = useMemo(() => ({ approve: items.filter((i) => i.state === "approve").length, ready: items.filter((i) => i.state === "ready").length, all: items.length }), [items]);
  const types = [...new Set(items.map((i) => i.section))];
  const shown = items.filter((i) => (view === "all" || i.state === view) && (type === "all" || i.section === type));

  const onAction = async (item, action, channelId) => {
    setBusy(item.key);
    try {
      const r = await api("/api/review", { method: "POST", body: { jobId: item.jobId, section: item.section, action, ...(channelId && { channelId }) } });
      setItems(r.items);
      const res = r.result;
      if (res?.kind === "scheduled") toast.success(`Scheduled on ${res.channel} for ${when(res.dueAt)}.`);
      else if (res?.kind === "sent") toast.success("Sent to the website as an unpublished draft.", res.url ? { action: { label: "Open", onClick: () => window.open(res.adminUrl || res.url, "_blank", "noopener") } } : undefined);
      else if (res?.kind === "posted") toast.success("Marked as posted.");
      else if (action === "approve" && item.next !== "posted") toast.success("Approved — it's under Ready to go out.");
      else if (action === "unapprove") toast.success("Approval removed.");
      return true;
    } catch (e) {
      toast.error(e.message);
      // An approve-and-send can approve and then fail to send: show the new state.
      api("/api/review").then((r) => setItems(r.items)).catch(() => {});
      return false;
    } finally {
      setBusy(null);
    }
  };

  const onRan = () => api("/api/review").then((r) => {
    setItems(r.items);
    setView("approve");
  });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AutopilotPanel autopilot={autopilot} onRan={onRan} />

      <section aria-labelledby="queue-title" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="queue-title" className="sr-only">
            Queue
          </h2>
          <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Show">
            {[
              ["approve", "To approve"],
              ["ready", "Ready to go out"],
              ["all", "All"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={cn("rounded-md px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring", view === id ? "bg-white text-gray-900 shadow-paper" : "text-gray-600")}
              >
                {label} <span className="tabular-nums text-gray-500">{counts[id]}</span>
              </button>
            ))}
          </div>
          {types.length > 1 && (
            <select aria-label="Type" className={cn(selectClass, "h-9 text-sm")} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">Every type</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {SECTION_CHIP[t]}
                </option>
              ))}
            </select>
          )}
        </div>
        {!social.postingEnabled && <p className="text-xs text-gray-600">Posting to Buffer is switched off (ENABLE_BUFFER_POSTING), so scheduling is disabled. Approving still works.</p>}

        {shown.length ? (
          <ul className="flex flex-col gap-3">
            {shown.map((item) => (
              <ReviewCard key={item.key} item={item} channels={channels} social={social} websiteConnected={websiteConnected} onAction={onAction} busy={busy === item.key} />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-10 text-center shadow-paper">
            <Inbox className="size-6 text-gray-400" />
            <p className="text-sm font-medium text-gray-900">{view === "approve" ? "Nothing waiting for approval" : view === "ready" ? "Nothing approved and waiting to go out" : "The queue is empty"}</p>
            <p className="max-w-prose text-sm text-gray-600">Run autopilot above, draft an idea from the content pipeline, or add a job.</p>
          </div>
        )}
      </section>
    </div>
  );
}
