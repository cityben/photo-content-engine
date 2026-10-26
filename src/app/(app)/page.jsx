import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Plus } from "lucide-react";

import { auth } from "@/auth";
import { PostRow } from "@/components/post-row";
import { TargetsPanel } from "@/components/targets-panel";
import { PageHeader } from "@/components/shell/app-shell";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mainImageOf, needsApproval } from "@/lib/content";
import { latestInsights } from "@/lib/growth";
import { listJobs } from "@/lib/jobs";
import { setupStatus } from "@/lib/setup";
import { analytics, listPosts } from "@/lib/social";
import { formatDateTime } from "@/lib/time";
import { formatNumber } from "@/lib/ui-labels";

export const dynamic = "force-dynamic";

async function safe(promise, fallback) {
  try {
    return await promise;
  } catch (error) {
    console.error("[dashboard]", error.message);
    return fallback;
  }
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function Dashboard() {
  const session = await auth();
  const now = new Date();
  const in14 = new Date(now.getTime() + 14 * 86400000);
  const ago30 = new Date(now.getTime() - 30 * 86400000);

  const [jobs, upcoming, stats, insights] = await Promise.all([
    safe(listJobs(), []),
    safe(listPosts({ start: now.toISOString(), end: in14.toISOString(), statuses: ["scheduled", "sending", "error"] }), null),
    safe(analytics({ start: ago30.toISOString(), end: now.toISOString() }), null),
    safe(latestInsights(), null),
  ]);

  const setup = await safe(setupStatus(), []);
  const remaining = setup.filter((s) => !s.done);
  const metric = (type) => stats?.totals?.find((m) => m.type === type);
  const next7 = upcoming?.filter((p) => new Date(p.dueAt) < new Date(now.getTime() + 7 * 86400000)) || [];
  const casesSent = jobs.filter((j) => j.website?.projectId).length;
  const awaiting = jobs.filter((j) => needsApproval(j).length > 0);
  const name = session?.user?.name ? `, ${session.user.name.split(/[ .]/)[0].replace(/^./, (c) => c.toUpperCase())}` : "";

  return (
    <>
      <PageHeader
        title={`${greeting()}${name}`}
        description="What's going out, how it's doing, and what to do next."
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <Plus /> New job
            </Link>
          </Button>
        }
      />

      {remaining.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Finish setting up</CardTitle>
            <CardDescription>
              {setup.length - remaining.length} of {setup.length} connected. Everything works in sandbox mode meanwhile.
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings">
                  Settings <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {setup.map((s) => (
                <li key={s.id} className="flex items-start gap-2.5 rounded-lg bg-gray-50 p-3">
                  {s.done ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-gray-400" />
                  )}
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-gray-800">{s.label}</span>
                    <span className="text-xs text-gray-500">{s.done ? s.detail : s.fix}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <TargetsPanel compact />

      {awaiting.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Waiting for approval</CardTitle>
            <CardDescription>Nothing here goes to Buffer or the website until someone approves it.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {awaiting.slice(0, 5).map((j) => (
              <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 text-sm outline-none transition-colors hover:bg-gray-100 focus-visible:ring-[3px] focus-visible:ring-ring">
                <span className="truncate font-medium text-gray-800">{j.title}</span>
                <Badge variant="secondary">{needsApproval(j).length} to approve</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Scheduled · 7 days" value={upcoming ? next7.length : "—"} hint={upcoming ? `${upcoming.length} in the next 14 days` : "Couldn't reach Buffer"} />
        <StatTile label="Published · 30 days" value={stats ? stats.posts.length : "—"} hint={stats?.simulated ? "Sandbox posts" : "Across LinkedIn and Instagram"} />
        <StatTile
          label="Impressions · 30 days"
          value={formatNumber(metric("impressions")?.value)}
          hint={stats?.simulated ? "Simulated in sandbox" : metric("engagementRate") ? `${formatNumber(metric("engagementRate").value, "percentage")} engagement` : "From Buffer"}
        />
        <StatTile label="Case studies sent" value={casesSent} hint={`${jobs.length} job${jobs.length === 1 ? "" : "s"} in total`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Coming up</CardTitle>
            <CardDescription>The next 14 days, UK time.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/calendar">
                  Calendar <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {upcoming === null ? (
              <p className="rounded-lg bg-destructive-soft p-4 text-sm text-destructive">Couldn&apos;t load posts from Buffer. Check Settings.</p>
            ) : upcoming.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-lg bg-gray-50 p-6">
                <p className="text-sm text-gray-600">Nothing scheduled. Turn a finished job into posts.</p>
                <Button size="sm" asChild>
                  <Link href="/jobs/new">
                    <Plus /> New job
                  </Link>
                </Button>
              </div>
            ) : (
              upcoming.slice(0, 6).map((post) => <PostRow key={post.id} post={post} />)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Do next</CardTitle>
            <CardDescription>
              {insights ? `AI advice from ${formatDateTime(insights.createdAt)}` : "AI advice based on your numbers."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {insights ? (
              <>
                {insights.recommendations.slice(0, 3).map((r) => (
                  <div key={r.title} className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800">{r.title}</p>
                      {r.impact === "high" && <Badge>High impact</Badge>}
                    </div>
                    <p className="line-clamp-3 text-xs text-gray-600">{r.detail}</p>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="self-start" asChild>
                  <Link href="/insights">
                    All insights <ArrowRight />
                  </Link>
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-start gap-3 rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">No insights yet. Generate them from your latest stats.</p>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/insights">Open Growth insights</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent jobs</CardTitle>
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/jobs">
                All jobs <ArrowRight />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">No jobs yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {jobs.slice(0, 4).map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-lg bg-gray-50 outline-none transition-colors hover:bg-gray-100 focus-visible:ring-[3px] focus-visible:ring-ring"
                  >
                    <div className="relative aspect-[4/3] bg-gray-100">
                      {mainImageOf(job) && (
                        <Image src={mainImageOf(job).url} alt="" fill unoptimized sizes="300px" className="object-cover" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1 p-3">
                      <span className="line-clamp-1 text-sm font-medium text-gray-800">{job.title}</span>
                      <span className="text-xs text-gray-500">
                        {job.posts?.length ? `${job.posts.length} post${job.posts.length === 1 ? "" : "s"}` : job.content?.linkedin || job.content?.caseStudy ? "Ready to schedule" : "Not written"}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
