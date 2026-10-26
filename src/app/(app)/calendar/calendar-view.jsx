"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { AlertCircle, ChevronLeft, ChevronRight, ExternalLink, Loader2, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ChannelChip, StatusBadge } from "@/components/post-row";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { dateToZonedInput, dayKey, formatDateTime, formatTime, zonedToDate } from "@/lib/time";
import { serviceInfo } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function range(view, cursor) {
  if (view === "week") {
    const start = startOfWeek(cursor, { weekStartsOn: 1 });
    return { start, end: endOfWeek(cursor, { weekStartsOn: 1 }) };
  }
  return {
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
  };
}

function PostChip({ post, onOpen, roomy }) {
  const info = serviceInfo(post.service);
  const when = post.status === "sent" ? post.sentAt || post.dueAt : post.dueAt;
  return (
    <button
      type="button"
      onClick={() => onOpen(post)}
      className={cn(
        "flex w-full min-w-0 items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-xs outline-none transition-[filter] hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring",
        info.chip,
        post.status === "sent" && "opacity-70",
        post.status === "error" && "bg-destructive-soft text-destructive"
      )}
    >
      <span aria-hidden className={cn("mt-1 size-1.5 shrink-0 rounded-full", post.status === "error" ? "bg-destructive" : info.dot)} />
      <span className="min-w-0 flex-1">
        <span className="font-medium tabular-nums">{formatTime(when)}</span>{" "}
        <span className={cn(roomy ? "line-clamp-3" : "line-clamp-1")}>{post.text}</span>
      </span>
    </button>
  );
}

function PostSheet({ post, onClose, onChanged, postingEnabled }) {
  const [text, setText] = useState(post?.text || "");
  const [when, setWhen] = useState(post ? dateToZonedInput(post.dueAt) : "");
  const [busy, setBusy] = useState(null);

  if (!post) return null;
  const editable = post.status === "scheduled" && postingEnabled;
  const info = serviceInfo(post.service);
  const changed = text !== post.text || when !== dateToZonedInput(post.dueAt);

  const save = async () => {
    setBusy("save");
    try {
      const body = {};
      if (text !== post.text) body.text = text;
      if (when !== dateToZonedInput(post.dueAt)) body.dueAt = zonedToDate(when).toISOString();
      await api(`/api/posts/${post.id}`, { method: "PATCH", body });
      toast.success("Post updated.");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(`Couldn't update: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    try {
      await api(`/api/posts/${post.id}`, { method: "DELETE" });
      toast.success("Post deleted.");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(`Couldn't delete: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>{info.label} post</SheetTitle>
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-2">
            <ChannelChip service={post.service} name={post.channelName} />
            <StatusBadge status={post.status} />
          </div>
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-1 flex-col gap-5 px-6 pb-6">
        {post.images?.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {post.images.map((src) => (
              <div key={src} className="relative size-24 shrink-0 overflow-hidden rounded-md bg-gray-100">
                <Image src={src} alt="" fill unoptimized sizes="96px" className="object-cover" />
              </div>
            ))}
          </div>
        )}
        {post.error && (
          <p className="flex items-start gap-2 rounded-md bg-destructive-soft p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {post.error}
          </p>
        )}

        {editable ? (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sheet-text">Text</Label>
                <span className={cn("text-xs tabular-nums text-gray-500", text.length > info.limit && "font-medium text-destructive")}>
                  {text.length}/{info.limit}
                </span>
              </div>
              <Textarea id="sheet-text" className="min-h-56" value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sheet-when">Date and time (UK)</Label>
              <Input id="sheet-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500">
              {post.status === "sent" ? `Published ${formatDateTime(post.sentAt || post.dueAt)}` : `Due ${formatDateTime(post.dueAt)}`}
              {!postingEnabled && post.status === "scheduled" && " · editing is off (ENABLE_BUFFER_POSTING)"}
            </p>
            <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm leading-6 text-gray-700">{post.text}</p>
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-2">
          {editable && (
            <Button onClick={save} disabled={!changed || busy !== null || !text.trim() || text.length > info.limit}>
              {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} Save
            </Button>
          )}
          {post.jobId && (
            <Button variant="outline" asChild>
              <Link href={`/jobs/${post.jobId}`}>Open job</Link>
            </Button>
          )}
          {post.externalLink && (
            <Button variant="outline" asChild>
              <a href={post.externalLink} target="_blank" rel="noreferrer">
                View post <ExternalLink />
              </a>
            </Button>
          )}
          {postingEnabled && post.status !== "sent" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive hover:bg-destructive-soft hover:text-destructive" disabled={busy !== null}>
                  {busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                  <AlertDialogDescription>It&apos;s removed from Buffer and won&apos;t be published. This can&apos;t be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction onClick={remove}>Delete post</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </>
  );
}

export function CalendarView({ postingEnabled, mode }) {
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState("all");
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState({ query: null, posts: [], error: null });

  const { start, end } = useMemo(() => range(view, cursor), [view, cursor]);
  const query = `${start.toISOString()}|${end.toISOString()}|${reloads}`;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ start: addDays(start, -1).toISOString(), end: addDays(end, 1).toISOString() });
    api(`/api/posts?${params}`)
      .then(({ posts }) => !cancelled && setResult({ query, posts, error: null }))
      .catch((e) => !cancelled && setResult((r) => ({ query, posts: r.posts, error: e.message })));
    return () => {
      cancelled = true;
    };
  }, [query, start, end]);

  const load = useCallback(() => setReloads((n) => n + 1), []);
  const loading = result.query !== query;
  const { posts, error } = result;

  const byDay = useMemo(() => {
    const map = new Map();
    for (const p of posts) {
      if (filter !== "all" && p.service !== filter) continue;
      const key = dayKey(p.status === "sent" ? p.sentAt || p.dueAt : p.dueAt);
      map.set(key, [...(map.get(key) || []), p]);
    }
    return map;
  }, [posts, filter]);

  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const todayKey = dayKey(new Date());
  const step = view === "week" ? addWeeks : addMonths;
  const counts = {
    scheduled: posts.filter((p) => p.status === "scheduled").length,
    sent: posts.filter((p) => p.status === "sent").length,
    error: posts.filter((p) => p.status === "error").length,
  };

  return (
    <div className="flex flex-col gap-4">
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
            {view === "week" ? `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}` : format(cursor, "MMMM yyyy")}
          </h2>
          {loading && <Loader2 className="ml-2 size-4 animate-spin text-gray-400" />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Channel">
            {["all", "linkedin", "instagram"].map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring", filter === f ? "bg-white text-gray-900 shadow-paper" : "text-gray-600 hover:text-gray-900")}
              >
                {f === "all" ? "All" : serviceInfo(f).label}
              </button>
            ))}
          </div>
          <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="View">
            {["month", "week"].map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize outline-none focus-visible:ring-[3px] focus-visible:ring-ring", view === v ? "bg-white text-gray-900 shadow-paper" : "text-gray-600 hover:text-gray-900")}
              >
                {v}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={load} aria-label="Refresh">
            <RefreshCw />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-gray-600">
        <span className="rounded-full bg-white px-3 py-1 shadow-paper">{counts.scheduled} scheduled</span>
        <span className="rounded-full bg-white px-3 py-1 shadow-paper">{counts.sent} published</span>
        {counts.error > 0 && <span className="rounded-full bg-destructive-soft px-3 py-1 text-destructive">{counts.error} failed</span>}
        {mode === "sandbox" && <span className="rounded-full bg-gray-100 px-3 py-1">Sandbox data</span>}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive-soft p-4 text-sm text-destructive">
          Couldn&apos;t load posts: {error}
        </p>
      )}

      {/* Month/week grid (tablet and up) */}
      <div className="hidden overflow-hidden rounded-xl bg-white shadow-paper md:block">
        <div className="grid grid-cols-7 bg-gray-50">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-3 py-2 text-xs font-medium text-gray-500">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-100">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const items = byDay.get(key) || [];
            const outside = view === "month" && d.getMonth() !== cursor.getMonth();
            const isToday = key === todayKey;
            return (
              <div key={key} className={cn("flex flex-col gap-1 bg-white p-1.5", view === "week" ? "min-h-96" : "min-h-28", outside && "bg-gray-50/80")}>
                <span
                  className={cn(
                    "mb-0.5 flex size-6 items-center justify-center self-start rounded-full text-xs tabular-nums",
                    isToday ? "bg-primary font-semibold text-white" : outside ? "text-gray-400" : "text-gray-600"
                  )}
                >
                  {format(d, "d")}
                </span>
                {items.slice(0, view === "week" ? 20 : 3).map((p) => (
                  <PostChip key={p.id} post={p} onOpen={setOpen} roomy={view === "week"} />
                ))}
                {view === "month" && items.length > 3 && (
                  <button type="button" onClick={() => { setView("week"); setCursor(d); }} className="px-1.5 text-left text-xs font-medium text-primary hover:underline">
                    +{items.length - 3} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda list (phones) */}
      <div className="flex flex-col gap-3 md:hidden">
        {days.filter((d) => byDay.has(format(d, "yyyy-MM-dd"))).length === 0 && !loading && (
          <p className="rounded-xl bg-white p-6 text-sm text-gray-600 shadow-paper">No posts in this {view}.</p>
        )}
        {days
          .filter((d) => byDay.has(format(d, "yyyy-MM-dd")))
          .map((d) => {
            const key = format(d, "yyyy-MM-dd");
            return (
              <div key={key} className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-paper">
                <p className={cn("text-sm font-semibold", key === todayKey ? "text-primary" : "text-gray-800")}>{format(d, "EEEE d MMMM")}</p>
                {byDay.get(key).map((p) => (
                  <PostChip key={p.id} post={p} onOpen={setOpen} roomy />
                ))}
              </div>
            );
          })}
      </div>

      <Sheet open={Boolean(open)} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent>
          {open && <PostSheet key={open.id} post={open} onClose={() => setOpen(null)} onChanged={load} postingEnabled={postingEnabled} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
