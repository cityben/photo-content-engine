"use client";

import Image from "next/image";
import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Inbox, ListOrdered, Loader2 } from "lucide-react";

import { ChannelChip } from "@/components/post-row";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ReadyCard({ item, onQueue, busy, draggable }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ready:${item.jobId}:${item.service}`,
    data: { kind: "ready", item },
    disabled: !draggable,
  });
  return (
    <li ref={setNodeRef} className={cn("flex flex-col gap-2 rounded-lg bg-gray-50 p-3", isDragging && "opacity-30")}>
      <div className="flex items-start gap-2">
        <span
          {...(draggable ? { ...attributes, ...listeners } : {})}
          className={cn("mt-0.5 rounded p-0.5 text-gray-400 outline-none focus-visible:ring-[3px] focus-visible:ring-ring", draggable && "cursor-grab touch-none hover:bg-gray-200 active:cursor-grabbing")}
          aria-label={`Drag ${item.jobTitle} onto the calendar`}
        >
          <GripVertical className="size-4" />
        </span>
        {item.image && (
          <div className="relative size-10 shrink-0 overflow-hidden rounded bg-gray-100">
            <Image src={item.image} alt="" fill unoptimized sizes="40px" className="object-cover" />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link href={`/jobs/${item.jobId}`} className="truncate text-sm font-medium text-gray-800 hover:underline">
            {item.jobTitle}
          </Link>
          <ChannelChip service={item.service} className="self-start" />
        </div>
      </div>
      <p className="line-clamp-2 text-xs text-gray-600">{item.text}</p>
      <Button size="sm" variant="outline" className="self-start bg-white" onClick={() => onQueue(item)} disabled={busy || !draggable}>
        {busy ? <Loader2 className="animate-spin" /> : <ListOrdered />} Next slot
      </Button>
    </li>
  );
}

export function ReadyTray({ items, onQueue, busyKey, postingEnabled }) {
  return (
    <aside className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-paper" aria-label="Ready to schedule">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Ready to schedule</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs tabular-nums text-gray-600">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="flex flex-col items-center gap-2 rounded-lg bg-gray-50 p-6 text-center text-xs text-gray-500">
          <Inbox className="size-5" />
          Approved posts that aren&apos;t scheduled yet appear here. Drag them onto a day or time.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <ReadyCard
              key={`${item.jobId}-${item.service}`}
              item={item}
              onQueue={onQueue}
              busy={busyKey === `${item.jobId}:${item.service}`}
              draggable={postingEnabled}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}
