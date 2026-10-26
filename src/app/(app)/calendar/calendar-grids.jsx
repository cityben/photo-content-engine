"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { format } from "date-fns";
import { AlertTriangle, CalendarPlus } from "lucide-react";

import { StatusBadge } from "@/components/post-row";
import { dayKey, formatTime, weekdayOf } from "@/lib/time";
import { serviceInfo } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const HOURS = Array.from({ length: 32 }, (_, i) => {
  const minutes = 6 * 60 + i * 30; // 06:00 → 21:30
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 ? "30" : "00"}`;
});

export const postTime = (p) => (p.status === "sent" ? p.sentAt || p.dueAt : p.dueAt);

export function canMove(post, postingEnabled) {
  return postingEnabled && post.status === "scheduled" && new Date(post.dueAt).getTime() > Date.now();
}

/** Is `key` a publishing day for the services in view? */
export function isPublishingDay(key, schedule, services) {
  return services.some((s) => schedule[s]?.days.includes(weekdayOf(key)));
}

/** Channels with more than one post that day. */
export function clashes(posts) {
  const count = {};
  for (const p of posts) if (p.status !== "error") count[p.service] = (count[p.service] || 0) + 1;
  return Object.entries(count).filter(([, n]) => n > 1).map(([s]) => s);
}

export function PostChip({ post, onOpen, roomy, draggable }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `post:${post.id}`,
    data: { kind: "post", post },
    disabled: !draggable,
  });
  const info = serviceInfo(post.service);
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...(draggable ? { ...attributes, ...listeners } : {})}
      onClick={() => onOpen(post)}
      title={draggable ? "Click to edit · drag to reschedule" : "Click to view"}
      className={cn(
        "flex w-full min-w-0 items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-xs outline-none transition-[filter,opacity] hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring",
        info.chip,
        draggable && "cursor-grab touch-none active:cursor-grabbing",
        post.status === "sent" && "opacity-70",
        post.status === "error" && "bg-destructive-soft text-destructive",
        isDragging && "opacity-30"
      )}
    >
      <span aria-hidden className={cn("mt-1 size-1.5 shrink-0 rounded-full", post.status === "error" ? "bg-destructive" : info.dot)} />
      <span className="min-w-0 flex-1">
        <span className="font-medium tabular-nums">{formatTime(postTime(post))}</span>{" "}
        <span className={cn(roomy ? "line-clamp-2" : "line-clamp-1")}>{post.text}</span>
      </span>
    </button>
  );
}

function DayCell({ id, disabled, className, children }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && !disabled && "bg-primary-soft ring-2 ring-primary/40 ring-inset")}>
      {children}
    </div>
  );
}

export function MonthGrid({ days, cursor, byDay, schedule, services, todayKey, onOpen, postingEnabled, onDayZoom }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-paper">
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
          const outside = d.getMonth() !== cursor.getMonth();
          const past = key < todayKey;
          const publishing = isPublishingDay(key, schedule, services);
          const clash = clashes(items);
          return (
            <DayCell
              key={key}
              id={`day:${key}`}
              disabled={past || !postingEnabled}
              className={cn(
                "flex min-h-28 flex-col gap-1 p-1.5",
                publishing ? "bg-white" : "bg-gray-50",
                outside && "opacity-60"
              )}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onDayZoom(d)}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs tabular-nums outline-none hover:bg-gray-100 focus-visible:ring-[3px] focus-visible:ring-ring",
                    key === todayKey ? "bg-primary font-semibold text-white hover:bg-primary" : "text-gray-600"
                  )}
                  aria-label={`Open week of ${format(d, "d MMMM")}`}
                >
                  {format(d, "d")}
                </button>
                {clash.length > 0 && (
                  <span title={`More than one ${clash.map((s) => serviceInfo(s).label).join(" and ")} post this day`}>
                    <AlertTriangle className="size-3.5 text-amber-600" />
                  </span>
                )}
                {publishing && !items.length && !past && <span className="text-[10px] text-gray-400">open</span>}
              </div>
              {items.slice(0, 3).map((p) => (
                <PostChip key={p.id} post={p} onOpen={onOpen} draggable={canMove(p, postingEnabled)} />
              ))}
              {items.length > 3 && (
                <button type="button" onClick={() => onDayZoom(d)} className="px-1.5 text-left text-xs font-medium text-primary hover:underline">
                  +{items.length - 3} more
                </button>
              )}
            </DayCell>
          );
        })}
      </div>
    </div>
  );
}

function slotFor(post) {
  const t = formatTime(postTime(post));
  const [h, m] = t.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${m < 30 ? "00" : "30"}`;
}

export function WeekGrid({ days, byDay, schedule, services, todayKey, onOpen, postingEnabled, nowKeyTime }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-paper">
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] bg-gray-50">
        <div />
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const items = byDay.get(key) || [];
          const clash = clashes(items);
          return (
            <div key={key} className={cn("flex flex-col px-2 py-2", !isPublishingDay(key, schedule, services) && "text-gray-400")}>
              <span className="text-xs font-medium">{format(d, "EEE")}</span>
              <span className="flex items-center gap-1.5">
                <span className={cn("text-sm tabular-nums", key === todayKey ? "font-bold text-primary" : "text-gray-800")}>{format(d, "d MMM")}</span>
                {clash.length > 0 && <AlertTriangle className="size-3.5 text-amber-600" aria-label="More than one post on a channel" />}
              </span>
            </div>
          );
        })}
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] gap-px bg-gray-100">
          {HOURS.map((time) => (
            <Row key={time} time={time} days={days} byDay={byDay} schedule={schedule} services={services} todayKey={todayKey} onOpen={onOpen} postingEnabled={postingEnabled} nowKeyTime={nowKeyTime} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ time, days, byDay, schedule, services, todayKey, onOpen, postingEnabled, nowKeyTime }) {
  return (
    <>
      <div className="bg-white px-2 pt-1 text-right text-[11px] tabular-nums text-gray-400">{time.endsWith(":00") ? time : ""}</div>
      {days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const slotPosts = (byDay.get(key) || []).filter((p) => slotFor(p) === time);
        const slotServices = services.filter((s) => schedule[s]?.days.includes(weekdayOf(key)) && schedule[s].times.some((t) => slotOf(t) === time));
        const past = `${key}T${time}` < nowKeyTime;
        return (
          <DayCell
            key={key}
            id={`slot:${key}T${time}`}
            disabled={past || !postingEnabled}
            className={cn(
              "flex min-h-9 flex-col gap-0.5 p-0.5",
              isPublishingDay(key, schedule, services) ? "bg-white" : "bg-gray-50",
              key < todayKey && "opacity-70"
            )}
          >
            {slotServices.length > 0 && !slotPosts.length && !past && (
              <span className="flex h-full min-h-7 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium text-gray-500 outline-1 -outline-offset-1 outline-gray-300 outline-dashed">
                {slotServices.map((s) => serviceInfo(s).label).join(" · ")} slot
              </span>
            )}
            {slotPosts.map((p) => (
              <PostChip key={p.id} post={p} onOpen={onOpen} roomy draggable={canMove(p, postingEnabled)} />
            ))}
          </DayCell>
        );
      })}
    </>
  );
}

const slotOf = (t) => {
  const [h, m] = t.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${m < 30 ? "00" : "30"}`;
};

/** Chronological list with open publishing slots shown as gaps. */
export function AgendaList({ days, byDay, schedule, services, todayKey, onOpen, nowKeyTime = "" }) {
  const rows = days
    .map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const posts = (byDay.get(key) || []).slice().sort((a, b) => (postTime(a) < postTime(b) ? -1 : 1));
      const open =
        key >= todayKey
          ? services.flatMap((s) =>
              schedule[s]?.days.includes(weekdayOf(key))
                ? schedule[s].times
                    .filter((t) => `${key}T${t}` > nowKeyTime)
                    .filter((t) => !posts.some((p) => p.service === s && formatTime(postTime(p)) === t))
                    .map((t) => ({ service: s, time: t }))
                : []
            )
          : [];
      return { d, key, posts, open };
    })
    .filter((r) => r.posts.length || r.open.length);

  if (!rows.length) return <p className="rounded-xl bg-white p-6 text-sm text-gray-600 shadow-paper">Nothing in this period.</p>;

  return (
    <div className="flex flex-col gap-3">
      {rows.map(({ d, key, posts, open }) => (
        <section key={key} className="rounded-xl bg-white p-4 shadow-paper" aria-label={format(d, "EEEE d MMMM")}>
          <h3 className={cn("mb-2 text-sm font-semibold", key === todayKey ? "text-primary" : "text-gray-800")}>
            {format(d, "EEEE d MMMM")} {key === todayKey && <span className="font-normal text-gray-500">· today</span>}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {posts.map((p) => {
              const info = serviceInfo(p.service);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(p)}
                    className="flex w-full items-start gap-3 rounded-lg bg-gray-50 p-2.5 text-left outline-none transition-colors hover:bg-gray-100 focus-visible:ring-[3px] focus-visible:ring-ring"
                  >
                    <span className="w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-gray-900">{formatTime(postTime(p))}</span>
                    <span className={cn("mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", info.chip)}>
                      <span aria-hidden className={cn("size-1.5 rounded-full", info.dot)} />
                      {info.label}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="line-clamp-2 text-sm text-gray-700">{p.text}</span>
                      {p.jobTitle && <span className="text-xs text-gray-500">{p.jobTitle}</span>}
                    </span>
                    <StatusBadge status={p.status} />
                  </button>
                </li>
              );
            })}
            {open.map((o) => (
              <li key={`${o.service}-${o.time}`} className="flex items-center gap-3 rounded-lg p-2.5 text-sm text-gray-500 outline-1 -outline-offset-1 outline-gray-200 outline-dashed">
                <span className="w-12 shrink-0 tabular-nums">{o.time}</span>
                <CalendarPlus className="size-4" /> Open {serviceInfo(o.service).label} slot ({DAY_NAMES[weekdayOf(key)]})
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export { dayKey };
