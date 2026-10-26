"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, ExternalLink, Loader2, Save, Trash2 } from "lucide-react";
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
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { dateToZonedInput, formatDateTime, zonedToDate } from "@/lib/time";
import { serviceInfo } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

/** Edit text/time or delete one post. */
export function PostSheet({ post, onClose, onChanged, postingEnabled }) {
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
