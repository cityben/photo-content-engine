import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { postingEnabled, socialMode } from "@/lib/social";

import { CalendarView } from "./calendar-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar — Content Engine" };

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        title="Calendar"
        description="Everything scheduled and published on LinkedIn and Instagram. Click a post to edit, reschedule or delete it. Times are UK time."
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <Plus /> New job
            </Link>
          </Button>
        }
      />
      <CalendarView postingEnabled={postingEnabled()} mode={socialMode()} />
    </>
  );
}
