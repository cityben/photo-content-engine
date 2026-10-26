import Image from "next/image";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/time";
import { POST_STATUS, serviceInfo } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

export function ChannelChip({ service, name, className }) {
  const info = serviceInfo(service);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", info.chip, className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", info.dot)} />
      {name || info.label}
    </span>
  );
}

export function StatusBadge({ status }) {
  const s = POST_STATUS[status] || { label: status, variant: "secondary" };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function PostRow({ post, showJob = true }) {
  const when = post.status === "sent" ? post.sentAt || post.dueAt : post.dueAt;
  return (
    <div className="flex gap-3 rounded-lg bg-gray-50 p-3">
      {post.images?.[0] ? (
        <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-gray-100">
          <Image src={post.images[0]} alt="" fill unoptimized sizes="56px" className="object-cover" />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <ChannelChip service={post.service} />
          <StatusBadge status={post.status} />
          <span className="text-xs text-gray-500">{formatDateTime(when)}</span>
        </div>
        <p className="line-clamp-2 text-sm text-gray-700">{post.text}</p>
        {post.error && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="size-3.5" /> {post.error}
          </p>
        )}
        {showJob && post.jobId && (
          <Link href={`/jobs/${post.jobId}`} className="w-fit text-xs font-medium text-primary hover:underline">
            {post.jobTitle || "Open job"}
          </Link>
        )}
      </div>
    </div>
  );
}
