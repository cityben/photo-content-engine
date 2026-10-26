"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  pointerWithin,
  PointerSensor,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { api } from "@/lib/client-api";
import { dateToZonedInput, dayKey, formatDateTime, formatTime, zonedToDate } from "@/lib/time";
import { TargetsPanel } from "@/components/targets-panel";
import { serviceInfo } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

import { AutofillDialog, ScheduleDialog } from "./calendar-dialogs";
import { AgendaList, clashes, MonthGrid, postTime, WeekGrid } from "./calendar-grids";
import { PostSheet } from "./post-sheet";
import { ReadyTray } from "./ready-tray";

function range(view, cursor) {
  if (view === "month") {
    return {
      start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
    };
  }
  if (view === "list") return { start: startOfWeek(cursor, { weekStartsOn: 1 }), end: addDays(startOfWeek(cursor, { weekStartsOn: 1 }), 27) };
  return { start: startOfWeek(cursor, { weekStartsOn: 1 }), end: endOfWeek(cursor, { weekStartsOn: 1 }) };
}

function Toggle({ value, onChange, options, label }) {
  return (
    <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
            value === id ? "bg-white text-gray-900 shadow-paper" : "text-gray-600 hover:text-gray-900"
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={cn("flex flex-col rounded-lg px-3 py-2", tone || "bg-white shadow-paper")}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

export function CalendarView({ postingEnabled, mode, initialSchedule, channels }) {
  const [view, setView] = useState("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [filter, setFilter] = useState("all");
  const [schedule, setSchedule] = useState(initialSchedule);
  const [open, setOpen] = useState(null);
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState({ query: null, posts: [], error: null });
  const [ready, setReady] = useState([]);
  const [upcoming, setUpcoming] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [dragging, setDragging] = useState(null);

  const { start, end } = useMemo(() => range(view, cursor), [view, cursor]);
  const query = `${start.toISOString()}|${end.toISOString()}|${reloads}`;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ start: addDays(start, -1).toISOString(), end: addDays(end, 1).toISOString() });
    api(`/api/posts?${params}`)
      .then(({ posts }) => !cancelled && setResult({ query, posts, error: null }))
      .catch((e) => !cancelled && setResult((r) => ({ query, posts: r.posts, error: e.message })));
    api("/api/calendar/ready")
      .then(({ items }) => !cancelled && setReady(items))
      .catch(() => {});
    const now = new Date();
    api(`/api/posts?${new URLSearchParams({ start: now.toISOString(), end: addDays(now, 60).toISOString() })}`)
      .then(({ posts }) => !cancelled && setUpcoming(posts.filter((p) => p.status === "scheduled").sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1))))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [query, start, end]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);
  const loading = result.query !== query;
  const { posts, error } = result;
  const services = filter === "all" ? ["linkedin", "instagram"] : [filter];

  const byDay = useMemo(() => {
    const map = new Map();
    for (const p of posts) {
      if (filter !== "all" && p.service !== filter) continue;
      const key = dayKey(postTime(p));
      map.set(key, [...(map.get(key) || []), p]);
    }
    for (const list of map.values()) list.sort((a, b) => (postTime(a) < postTime(b) ? -1 : 1));
    return map;
  }, [posts, filter]);

  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const todayKey = dayKey(new Date());
  const [nowKeyTime] = useState(() => dateToZonedInput(new Date()));
  const step = view === "month" ? addMonths : view === "list" ? (d, n) => addWeeks(d, 4 * n) : addWeeks;
  const inView = posts.filter((p) => filter === "all" || p.service === filter);
  const clashDays = [...byDay.values()].filter((list) => clashes(list).length).length;
  const next = upcoming?.find((p) => filter === "all" || p.service === filter);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Drop where the pointer is, not where the (wide) drag preview overlaps most.
  const collision = (args) => {
    const hits = pointerWithin(args);
    return hits.length ? hits : rectIntersection(args);
  };

  const channelFor = (service) => channels.find((c) => c.service === service && !c.disconnected);

  const targetTime = (overId, kind, data) => {
    if (overId.startsWith("slot:")) return overId.slice(5);
    const key = overId.slice(4);
    if (kind === "post") return `${key}T${formatTime(data.post.dueAt)}`;
    const times = schedule[data.item.service]?.times || ["09:00"];
    return `${key}T${times[0]}`;
  };

  const movePost = async (post, dueAt, { quiet } = {}) => {
    const previous = post.dueAt;
    setResult((r) => ({ ...r, posts: r.posts.map((p) => (p.id === post.id ? { ...p, dueAt } : p)) }));
    try {
      await api(`/api/posts/${post.id}`, { method: "PATCH", body: { dueAt } });
      if (!quiet) {
        toast.success(`Moved to ${formatDateTime(dueAt)}`, {
          action: { label: "Undo", onClick: () => movePost({ ...post, dueAt }, previous, { quiet: true }).then(() => toast.success("Moved back.")) },
        });
      }
      reload();
    } catch (e) {
      setResult((r) => ({ ...r, posts: r.posts.map((p) => (p.id === post.id ? { ...p, dueAt: previous } : p)) }));
      toast.error(`Couldn't move it: ${e.message}`);
    }
  };

  const scheduleReady = async (item, dueAt) => {
    const channel = channelFor(item.service);
    if (!channel) return toast.error(`No ${serviceInfo(item.service).label} channel connected.`);
    const key = `${item.jobId}:${item.service}`;
    setBusyKey(key);
    try {
      const { post } = await api(`/api/jobs/${item.jobId}/schedule`, {
        method: "POST",
        body: { channelId: channel.id, ...(dueAt ? { dueAt } : {}) },
      });
      toast.success(`${item.jobTitle}: ${serviceInfo(item.service).label} scheduled for ${formatDateTime(post.dueAt)}`);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyKey(null);
    }
  };

  const onDragEnd = ({ active, over }) => {
    setDragging(null);
    if (!over) return;
    const data = active.data.current;
    const when = zonedToDate(targetTime(String(over.id), data.kind, data));
    if (when.getTime() < Date.now()) return toast.error("That time has passed.");
    const dueAt = when.toISOString();
    if (data.kind === "post") {
      if (new Date(data.post.dueAt).getTime() === when.getTime()) return;
      movePost(data.post, dueAt);
    } else {
      scheduleReady(data.item, dueAt);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={({ active }) => setDragging(active.data.current)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="flex flex-col gap-4">
        <TargetsPanel reloadKey={reloads} onSchedule={postingEnabled ? scheduleReady : undefined} busyKey={busyKey} />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-paper">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setCursor((c) => step(c, -1))} aria-label="Previous">
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setCursor((c) => step(c, 1))} aria-label="Next">
              <ChevronRight />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
              Today
            </Button>
            <h2 className="ml-2 text-base font-semibold text-gray-900 sm:text-lg">
              {view === "month" ? format(cursor, "MMMM yyyy") : `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`}
            </h2>
            {loading && <Loader2 className="ml-2 size-4 animate-spin text-gray-400" />}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Toggle label="Channel" value={filter} onChange={setFilter} options={[["all", "All"], ["linkedin", "LinkedIn"], ["instagram", "Instagram"]]} />
            <div className="hidden md:block">
              <Toggle label="View" value={view} onChange={setView} options={[["week", "Week"], ["month", "Month"], ["list", "List"]]} />
            </div>
            <ScheduleDialog schedule={schedule} onSaved={(s) => { setSchedule(s); reload(); }} />
            <AutofillDialog readyCount={ready.length} onDone={reload} disabled={!postingEnabled} />
            <Button variant="ghost" size="icon-sm" onClick={reload} aria-label="Refresh">
              <RefreshCw />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          <Stat label="Next out" value={next ? `${serviceInfo(next.service).label} · ${formatDateTime(next.dueAt)}` : "Nothing scheduled"} />
          <Stat label="Scheduled in view" value={inView.filter((p) => p.status === "scheduled").length} />
          <Stat label="Published in view" value={inView.filter((p) => p.status === "sent").length} />
          <Stat label="Ready to schedule" value={ready.length} />
          {clashDays > 0 ? (
            <Stat label="Clashes" value={<span className="inline-flex items-center gap-1"><AlertTriangle className="size-3.5 text-amber-600" /> {clashDays} day{clashDays === 1 ? "" : "s"}</span>} tone="bg-amber-50" />
          ) : (
            <Stat label="Failed" value={inView.filter((p) => p.status === "error").length} />
          )}
        </div>

        {!postingEnabled && (
          <p className="rounded-xl bg-white p-3 text-sm text-gray-600 shadow-paper">
            Read only: posting to Buffer is switched off (ENABLE_BUFFER_POSTING). Dragging and scheduling are disabled.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-destructive-soft p-4 text-sm text-destructive">
            Couldn&apos;t load posts: {error}
          </p>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_288px]">
          <div className="min-w-0">
            <div className="hidden md:block">
              {view === "week" && (
                <WeekGrid days={days} byDay={byDay} schedule={schedule} services={services} todayKey={todayKey} onOpen={setOpen} postingEnabled={postingEnabled} nowKeyTime={nowKeyTime} />
              )}
              {view === "month" && (
                <MonthGrid
                  days={days}
                  cursor={cursor}
                  byDay={byDay}
                  schedule={schedule}
                  services={services}
                  todayKey={todayKey}
                  onOpen={setOpen}
                  postingEnabled={postingEnabled}
                  onDayZoom={(d) => {
                    setView("week");
                    setCursor(d);
                  }}
                />
              )}
              {view === "list" && <AgendaList days={days} byDay={byDay} schedule={schedule} services={services} todayKey={todayKey} onOpen={setOpen} nowKeyTime={nowKeyTime} />}
            </div>
            <div className="md:hidden">
              <AgendaList days={days} byDay={byDay} schedule={schedule} services={services} todayKey={todayKey} onOpen={setOpen} nowKeyTime={nowKeyTime} />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Drag a post to move it (Undo appears) · drag from Ready to schedule · dashed boxes are open publishing slots · shaded days aren&apos;t publishing days{mode === "sandbox" ? " · sandbox data" : ""}.
            </p>
          </div>
          <ReadyTray items={ready.filter((i) => filter === "all" || i.service === filter)} onQueue={(item) => scheduleReady(item)} busyKey={busyKey} postingEnabled={postingEnabled} />
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className={cn("w-56 rounded-md px-2 py-1.5 text-xs shadow-paper-lg", serviceInfo(dragging.post?.service || dragging.item?.service).chip)}>
            <span className="line-clamp-2">{dragging.post?.text || dragging.item?.text}</span>
          </div>
        )}
      </DragOverlay>

      <Sheet open={Boolean(open)} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent>
          {open && <PostSheet key={open.id} post={open} onClose={() => setOpen(null)} onChanged={reload} postingEnabled={postingEnabled} />}
        </SheetContent>
      </Sheet>
    </DndContext>
  );
}
