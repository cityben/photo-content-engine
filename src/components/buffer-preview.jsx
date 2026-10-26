"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CalendarClock, Info, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BUFFER_CHANNELS } from "@/lib/formats";
import { cn } from "@/lib/utils";

function PostPreview({ channel, text, photo }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto flex max-w-md flex-col gap-3 rounded-lg bg-white p-4 shadow-paper">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
            CC
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900">Acme Ltd</span>
            <span className="text-xs text-gray-500">{channel.label} · Preview</span>
          </div>
        </div>
        {text ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{text}</p>
        ) : (
          <p className="text-sm text-gray-500">Nothing to post yet.</p>
        )}
        {photo && (
          <div
            className={cn(
              "relative overflow-hidden rounded-md bg-gray-100",
              channel.key === "instagram" ? "aspect-square" : "aspect-[16/10]"
            )}
          >
            <Image
              src={photo.dataUrl}
              alt="Job photo attached to the post"
              fill
              unoptimized
              sizes="448px"
              className="object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function useBufferStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/buffer")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatus(null));
    return () => {
      cancelled = true;
    };
  }, []);
  return status;
}

function blockedReason(status, channel) {
  if (!status) return "Checking Buffer connection…";
  if (!status.configured) return "Add BUFFER_API_TOKEN to connect Buffer.";
  if (!status.posting_enabled) return "Buffer posting is off. Set ENABLE_BUFFER_POSTING=true to send posts.";
  if (!status.profiles?.[channel.key])
    return `No ${channel.label} profile ID in BUFFER_PROFILE_IDS.`;
  return null;
}

export function BufferPreview({ content, photo }) {
  const status = useBufferStatus();
  const [active, setActive] = useState(BUFFER_CHANNELS[0].key);
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(BUFFER_CHANNELS.map((c) => [c.key, c.textFrom(content)]))
  );
  const [schedule, setSchedule] = useState("");
  const [sending, setSending] = useState(null);

  const send = async (channel) => {
    setSending(channel.key);
    try {
      const res = await fetch("/api/buffer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: channel.key,
          content: drafts[channel.key],
          scheduledTime: schedule ? new Date(schedule).toISOString() : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.details || body.error || `Buffer returned ${res.status}`);
      toast.success(
        schedule
          ? `${channel.label} post scheduled in Buffer`
          : `${channel.label} post added to your Buffer queue`
      );
    } catch (error) {
      toast.error(`Couldn't send to Buffer: ${error.message}`);
    } finally {
      setSending(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Buffer preview</CardTitle>
        <CardDescription>
          Edit each post, check how it reads, then send it to your Buffer queue.
        </CardDescription>
        <CardAction>
          {status?.configured && status?.posting_enabled ? (
            <Badge variant="success">Connected</Badge>
          ) : (
            <Badge variant="secondary">{status ? "Not sending" : "Checking…"}</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        <Tabs value={active} onValueChange={setActive}>
          <TabsList>
            {BUFFER_CHANNELS.map((c) => (
              <TabsTrigger key={c.key} value={c.key}>
                {c.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {BUFFER_CHANNELS.map((channel) => {
            const text = drafts[channel.key] || "";
            const over = text.length > channel.limit;
            const blocked = blockedReason(status, channel);

            return (
              <TabsContent key={channel.key} value={channel.key}>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`draft-${channel.key}`}>Post text</Label>
                        <span
                          className={cn(
                            "text-xs tabular-nums text-gray-500",
                            over && "font-medium text-destructive"
                          )}
                        >
                          {text.length.toLocaleString()} / {channel.limit.toLocaleString()}
                        </span>
                      </div>
                      <Textarea
                        id={`draft-${channel.key}`}
                        value={text}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [channel.key]: e.target.value }))
                        }
                        className="min-h-56"
                      />
                      {channel.key === "twitter" && (
                        <p className="text-xs text-gray-500">
                          Buffer receives the first post of the thread. Copy the full thread from its card.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`schedule-${channel.key}`}>
                        <CalendarClock className="size-4 text-gray-500" /> Schedule (optional)
                      </Label>
                      <Input
                        id={`schedule-${channel.key}`}
                        type="datetime-local"
                        value={schedule}
                        onChange={(e) => setSchedule(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-3 rounded-lg bg-gray-50 p-4">
                      {(blocked || photo) && (
                        <p className="flex items-start gap-2 text-xs leading-5 text-gray-600">
                          <Info className="mt-0.5 size-3.5 shrink-0 text-gray-500" />
                          {blocked ||
                            "Buffer gets the text only — attach the photo in Buffer before it publishes."}
                        </p>
                      )}
                      <Button
                        onClick={() => send(channel)}
                        disabled={Boolean(blocked) || over || !text.trim() || sending !== null}
                        className="w-full sm:w-auto sm:self-start"
                      >
                        {sending === channel.key ? <Loader2 className="animate-spin" /> : <Send />}
                        {sending === channel.key
                          ? "Sending…"
                          : schedule
                            ? `Schedule on ${channel.label}`
                            : "Add to Buffer queue"}
                      </Button>
                    </div>
                  </div>

                  <PostPreview channel={channel} text={text} photo={photo} />
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
