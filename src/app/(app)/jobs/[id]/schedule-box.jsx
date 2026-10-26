"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Info, ListOrdered, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/client-api";
import { APP_TIMEZONE, dateToZonedInput, formatDateTime, nextQueueSlot, zonedToDate } from "@/lib/time";
import { cn } from "@/lib/utils";

export function ScheduleBox({ job, service, text, imageUrls, social, problem }) {
  const router = useRouter();
  const channels = social.channels.filter((c) => c.service === service && !c.disconnected);
  const [channelId, setChannelId] = useState(channels[0]?.id || "");
  const [mode, setMode] = useState("queue");
  const [when, setWhen] = useState(() => dateToZonedInput(nextQueueSlot(new Date(Date.now() + 86400000))));
  const [busy, setBusy] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const whenDate = useMemo(() => {
    try {
      return when ? zonedToDate(when) : null;
    } catch {
      return null;
    }
  }, [when]);

  const blocked =
    !social.postingEnabled
      ? "Posting to Buffer is switched off (ENABLE_BUFFER_POSTING). The calendar still shows real posts."
      : !channels.length
        ? `No ${service === "linkedin" ? "LinkedIn" : "Instagram"} channel is connected in Buffer.`
        : problem;

  const pastTime = mode === "time" && whenDate && whenDate.getTime() < openedAt;

  const schedule = async () => {
    setBusy(true);
    try {
      const { post } = await api(`/api/jobs/${job.id}/schedule`, {
        method: "POST",
        // The server posts the saved, approved wording.
        body: {
          channelId,
          imageUrls,
          dueAt: mode === "time" ? whenDate.toISOString() : null,
        },
      });
      toast.success(`Scheduled for ${formatDateTime(post.dueAt)}`);
      router.refresh();
    } catch (e) {
      toast.error(`Couldn't schedule: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-800">Schedule</p>

      {channels.length > 1 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`channel-${service}`}>Channel</Label>
          <Select value={channelId} onValueChange={setChannelId}>
            <SelectTrigger id={`channel-${service}`} className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {channels.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.paused ? " (queue paused)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {channels.length === 1 && (
        <p className="text-xs text-gray-600">
          To <span className="font-medium text-gray-800">{channels[0].name}</span>
          {channels[0].paused && " — queue is paused in Buffer, so it won't publish until you resume it"}
        </p>
      )}

      <div role="radiogroup" aria-label="When" className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
        {[
          { id: "queue", label: "Next slot", icon: ListOrdered },
          { id: "time", label: "Pick a time", icon: CalendarClock },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            onClick={() => setMode(id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
              mode === id ? "bg-white text-gray-900 shadow-paper" : "text-gray-600 hover:text-gray-900"
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {mode === "time" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`when-${service}`}>Date and time (UK)</Label>
          <Input id={`when-${service}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="bg-white" />
          {pastTime && <p className="text-xs text-destructive">That time has passed.</p>}
        </div>
      ) : (
        <p className="text-xs text-gray-600">
          {social.mode === "live" ? "Goes into the next free slot in this channel's Buffer posting schedule." : "Goes into the next free weekday slot (08:30, 12:30 or 17:30 UK)."}
        </p>
      )}

      {blocked && (
        <p className="flex items-start gap-2 text-xs leading-5 text-gray-600">
          <Info className="mt-0.5 size-3.5 shrink-0 text-gray-500" /> {blocked}
        </p>
      )}

      <Button onClick={schedule} disabled={busy || Boolean(blocked) || !channelId || !text.trim() || pastTime || (mode === "time" && !whenDate)}>
        {busy ? <Loader2 className="animate-spin" /> : <Send />}
        {busy ? "Scheduling…" : mode === "time" && whenDate ? `Schedule for ${formatDateTime(whenDate)}` : "Add to queue"}
      </Button>
      {social.mode === "sandbox" && <p className="text-xs text-gray-500">Sandbox: nothing is posted. Times shown in {APP_TIMEZONE.replace("_", " ")}.</p>}
    </div>
  );
}
