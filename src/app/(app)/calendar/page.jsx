import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { getSchedule } from "@/lib/schedule";
import { listChannels, postingEnabled, socialMode } from "@/lib/social";

import { CalendarView } from "./calendar-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar — Content Engine" };

export default async function CalendarPage() {
  const [schedule, channels] = await Promise.all([getSchedule(), listChannels().catch(() => [])]);
  return (
    <>
      <PageHeader
        title="Calendar"
        description="What goes out when, and whether you're on target. Drag approved posts onto open slots. UK time."
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <Plus /> New job
            </Link>
          </Button>
        }
      />
      <CalendarView postingEnabled={postingEnabled()} mode={socialMode()} initialSchedule={schedule} channels={channels} />
    </>
  );
}
