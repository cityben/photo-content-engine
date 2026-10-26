"use client";

import { useState } from "react";
import { CalendarClock, Loader2, Plus, Wand2, X } from "lucide-react";
import { toast } from "sonner";

import { ChannelChip } from "@/components/post-row";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { formatDateTime } from "@/lib/time";
import { serviceInfo } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

const DAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
];

export function ScheduleDialog({ schedule, onSaved }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(schedule);
  const [busy, setBusy] = useState(false);

  const toggleDay = (service, day) =>
    setDraft((d) => {
      const days = d[service].days.includes(day) ? d[service].days.filter((x) => x !== day) : [...d[service].days, day];
      return { ...d, [service]: { ...d[service], days } };
    });
  const setTimes = (service, times) => setDraft((d) => ({ ...d, [service]: { ...d[service], times } }));

  const save = async () => {
    setBusy(true);
    try {
      const { schedule: saved } = await api("/api/settings/schedule", { method: "PUT", body: { schedule: draft } });
      onSaved(saved);
      toast.success("Publishing days saved.");
      setOpen(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setDraft(schedule);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarClock /> Publishing days
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Publishing days</DialogTitle>
          <DialogDescription>
            When each channel posts (UK time) and how many posts a posting day needs. &quot;Next slot&quot;, Auto-fill and the Targets panel use these; other days are shaded on the calendar. You can still drag a post to any time.
          </DialogDescription>
        </DialogHeader>
        {Object.keys(draft).map((service) => (
          <section key={service} className="flex flex-col gap-3 rounded-lg bg-gray-50 p-4">
            <ChannelChip service={service} className="self-start" />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${serviceInfo(service).label} days`}>
              {DAYS.map(([day, label]) => {
                const on = draft[service].days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(service, day)}
                    className={cn(
                      "h-9 min-w-12 rounded-md px-2 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring",
                      on ? "bg-primary text-white" : "bg-white text-gray-600 shadow-paper hover:bg-gray-100"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {draft[service].times.map((t, i) => (
                <span key={i} className="flex items-center gap-1">
                  <Input
                    type="time"
                    value={t}
                    onChange={(e) => setTimes(service, draft[service].times.map((x, j) => (j === i ? e.target.value : x)))}
                    className="w-28 bg-white"
                    aria-label={`${serviceInfo(service).label} time ${i + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setTimes(service, draft[service].times.filter((_, j) => j !== i))}
                    disabled={draft[service].times.length <= 1}
                    aria-label="Remove time"
                  >
                    <X />
                  </Button>
                </span>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setTimes(service, [...draft[service].times, "12:00"])} disabled={draft[service].times.length >= 8}>
                <Plus /> Time
              </Button>
            </div>
            <label className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
              Target
              <select
                value={Math.min(draft[service].perDay || 1, draft[service].times.length)}
                onChange={(e) => setDraft((d) => ({ ...d, [service]: { ...d[service], perDay: Number(e.target.value) } }))}
                className="h-9 rounded-md bg-white px-2 text-sm shadow-paper"
                aria-label={`${serviceInfo(service).label} posts per posting day`}
              >
                {draft[service].times.map((_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              {`post${(draft[service].perDay || 1) > 1 ? "s" : ""} per posting day · ${draft[service].days.length * Math.min(draft[service].perDay || 1, draft[service].times.length)} a week`}
            </label>
          </section>
        ))}
        <DialogFooter>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AutofillDialog({ readyCount, onDone, disabled }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setPlan(null);
    try {
      const { plan } = await api("/api/calendar/autofill", { method: "POST", body: { apply: false } });
      setPlan(plan);
    } catch (e) {
      toast.error(e.message);
      setOpen(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    try {
      const { results } = await api("/api/calendar/autofill", { method: "POST", body: { apply: true } });
      const ok = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      toast.success(`Scheduled ${ok} post${ok === 1 ? "" : "s"}.`);
      failed.forEach((f) => toast.error(`${f.jobTitle} (${serviceInfo(f.service).label}): ${f.error}`));
      onDone();
      setOpen(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) load();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled || readyCount === 0}>
          <Wand2 /> Auto-fill{readyCount ? ` (${readyCount})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Auto-fill the calendar</DialogTitle>
          <DialogDescription>Every approved, unscheduled post goes into its channel&apos;s next free publishing slot. Check the plan, then confirm.</DialogDescription>
        </DialogHeader>
        {!plan ? (
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="size-4 animate-spin" /> Working out slots…
          </p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {plan.map((item) => (
              <li key={`${item.jobId}-${item.service}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 p-3 text-sm">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-gray-800">{item.jobTitle}</span>
                  <ChannelChip service={item.service} className="mt-1 self-start" />
                </span>
                <span className={cn("text-sm tabular-nums", item.problem ? "text-destructive" : "font-medium text-gray-900")}>
                  {item.problem || formatDateTime(item.dueAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button onClick={apply} disabled={busy || !plan?.some((p) => !p.problem)}>
            {busy && <Loader2 className="animate-spin" />} Schedule {plan ? plan.filter((p) => !p.problem).length : ""} posts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
