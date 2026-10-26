import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Inbox, Plus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { auth } from "@/auth";
import { AddToPipeline, KpiTile, ShareBar, Sparkline } from "@/components/dashboard-ui";
import { PostRow } from "@/components/post-row";
import { TargetsPanel } from "@/components/targets-panel";
import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAutopilot } from "@/lib/autopilot";
import { dashboardData } from "@/lib/dashboard";
import { notifications } from "@/lib/notifications";
import { setupStatus } from "@/lib/setup";
import { listPosts } from "@/lib/social";
import { formatNumber, serviceInfo } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

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

const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");
const pct = (n) => `${n > 0 ? "+" : ""}${Math.round(n * 100)}%`;
const pos = (p) => (p == null ? "—" : `#${Math.round(p)}`);

function Section({ id, title, description, action, children, className }) {
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-4 rounded-xl bg-white p-5 shadow-paper", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 max-w-prose flex-col gap-1">
          <h2 id={id} className="text-base font-semibold text-gray-900">
            {title}
          </h2>
          {description && <p className="text-sm text-gray-600">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children, href, cta }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
      <p>{children}</p>
      {href && (
        <Button size="sm" variant="outline" asChild>
          <Link href={href}>
            {cta} <ArrowRight />
          </Link>
        </Button>
      )}
    </div>
  );
}

function Change({ value, invert = false, suffix = "" }) {
  if (value == null || value === 0) return null;
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs tabular-nums text-gray-600">
      <Icon aria-hidden className={cn("size-3.5", good ? "text-primary" : "text-destructive")} />
      {value > 0 ? "+" : ""}
      {suffix === "%" ? Math.round(value * 100) : Number.isInteger(value) ? value : value.toFixed(1)}
      {suffix}
    </span>
  );
}

/* --- Sections -------------------------------------------------------------- */

function Kpis({ data }) {
  const k = data.website.summary?.kpis || {};
  const social = data.social;
  const impressions = (s) => s?.totals?.find((m) => m.type === "impressions")?.value ?? null;
  const now = impressions(social?.current);
  const before = impressions(social?.previous);
  const us = data.competitors.find((c) => c.you);
  const web = data.website.configured && !data.website.error;
  const tile = (key, label, opts = {}) => (
    <KpiTile key={key} label={label} value={k[key] ? (opts.format ? opts.format(k[key].now) : formatNumber(k[key].now)) : "—"} change={k[key]?.change ?? null} better={opts.better} hint={web ? "No comparison yet" : "Connect the website"} href={web ? "/analytics" : "/settings"} />
  );
  return (
    <section aria-label="Key numbers, last 28 days" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tile("users", "Website users")}
      {tile("gscClicks", "Google clicks")}
      {tile("gscPosition", "Avg. position", { better: "down", format: (v) => (v == null ? "—" : Number(v).toFixed(1)) })}
      {tile("enquiries", "Enquiries")}
      <KpiTile label="Social impressions" value={formatNumber(now)} change={now != null && before ? ((now - before) / before) * 100 : null} hint={social?.current?.simulated ? "Sandbox numbers" : "From Buffer"} href="/analytics" />
      <KpiTile label="Share of search" value={us?.share != null ? `${Math.round(us.share * 100)}%` : "—"} change={us?.change != null ? us.change * 100 : null} hint={data.hasMarket ? "vs tracked competitors" : "Run the Focus check"} href="/keywords?tab=competitors" />
    </section>
  );
}

function NeedsYou({ todo, autopilot }) {
  const review = todo.items.find((i) => i.key === "review");
  return (
    <Section
      id="needs-you"
      title="Needs you"
      description={todo.count ? `${todo.count} thing${todo.count === 1 ? "" : "s"} on the to-do list${todo.urgent ? `, ${todo.urgent} urgent` : ""}.` : "Nothing waiting. The weekly check and autopilot add here when they find something."}
      action={
        <Button size="sm" asChild>
          <Link href="/review">
            <Inbox /> Review queue
          </Link>
        </Button>
      }
    >
      {todo.items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {todo.items.slice(0, 6).map((i) => (
            <li key={i.key}>
              <Link href={i.href || "/"} className="flex items-start gap-2.5 rounded-lg p-2 text-sm outline-none transition-colors hover:bg-gray-50 focus-visible:ring-[3px] focus-visible:ring-ring">
                <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", i.severity === "high" ? "bg-destructive" : i.severity === "medium" ? "bg-primary" : "bg-gray-400")} />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium text-gray-900">{i.title}</span>
                  {i.detail && <span className="line-clamp-1 text-xs text-gray-600">{i.detail}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
        <Sparkles className="size-3.5 text-primary" />
        {autopilot.enabled ? `Autopilot drafts ${autopilot.perRun} ideas every Monday.` : "Autopilot is off — switch it on to draft from the pipeline each week."}
        {review ? ` ${review.title}.` : ""}
        <Link href="/review" className="font-medium text-primary underline-offset-4 hover:underline">
          Set up
        </Link>
      </p>
    </Section>
  );
}

function NotRanking({ data }) {
  const rows = data.ranking;
  return (
    <Section
      id="not-ranking"
      title="Why you're not ranking"
      description="Searches worth winning: where you stand, who's ahead, why, and the fix."
      action={data.marketAt && <span className="text-xs text-gray-500">Market data from {day(data.marketAt)}</span>}
    >
      {!rows.length ? (
        <Empty href={data.hasMarket ? "/keywords" : "/focus"} cta={data.hasMarket ? "Search & market" : "Run the growth check"}>
          {data.hasMarket || data.website.queries
            ? "No gaps found in the data held — refresh keyword demand and competitor gaps for a fuller picture."
            : "Needs Search Console (through the website) or DataForSEO market data. The growth check refreshes both."}
        </Empty>
      ) : (
        <div className="relative -mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Searches you could rank for, with reasons and fixes</caption>
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                <th scope="col" className="py-2 pr-4 font-medium">Search</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Searches/mo</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">You</th>
                <th scope="col" className="py-2 pr-4 font-medium">Beating you</th>
                <th scope="col" className="py-2 pr-4 font-medium">Why, and the fix</th>
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.keyword} className="border-b border-gray-100 align-top last:border-0">
                  <th scope="row" className="max-w-56 py-3 pr-4 text-left font-medium text-gray-900">
                    {r.keyword}
                    {r.intent && <span className="block text-xs font-normal text-gray-500">{r.intent}</span>}
                  </th>
                  <td className="py-3 pr-4 text-right tabular-nums text-gray-700">{r.volume != null ? formatNumber(r.volume) : r.impressions ? `${formatNumber(r.impressions)} impr.` : "—"}</td>
                  <td className="py-3 pr-4 text-right tabular-nums text-gray-900">
                    {r.ourPosition ? pos(r.ourPosition) : <span className="text-gray-500">not ranking</span>}
                    {r.positionChange != null && r.positionChange !== 0 && (
                      <span className="block">
                        <Change value={r.positionChange} />
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs text-gray-700">
                    {r.competitors.length ? (
                      <ul className="flex flex-col gap-0.5">
                        {r.competitors.map((c) => (
                          <li key={c.domain} className="tabular-nums">
                            {c.domain} <span className="text-gray-500">{pos(c.position)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="max-w-md py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {r.reasons.map((reason) => (
                        <Badge key={reason.kind} variant={reason.kind === "no-page" || reason.kind === "slipping" ? "destructive" : "secondary"} title={reason.detail}>
                          {reason.label}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-gray-600">{r.reasons[0].detail}</p>
                    <p className="mt-1 text-xs font-medium leading-5 text-gray-900">{r.fix}</p>
                  </td>
                  <td className="py-3">
                    <AddToPipeline keyword={r.keyword} volume={r.volume} inPipeline={r.pipeline} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function List({ items, empty, render }) {
  if (!items.length) return <p className="text-xs text-gray-500">{empty}</p>;
  return <ul className="flex flex-col divide-y divide-gray-100">{items.map(render)}</ul>;
}

function Working({ data }) {
  const w = data.working;
  return (
    <Section id="working" title="What's working" description="Gaining ground in the last 28 days.">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rising in Google</h3>
          <List
            items={w.risingQueries}
            empty={data.website.configured ? "No rising searches this period." : "Connect the website for Search Console data."}
            render={(q) => (
              <li key={q.query} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <span className="min-w-0 truncate text-gray-800">{q.query}</span>
                <span className="flex shrink-0 items-baseline gap-2 tabular-nums text-xs text-gray-600">
                  {q.clicks} clicks <Change value={q.clicksChange} /> {pos(q.position)}
                </span>
              </li>
            )}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Keywords moving up</h3>
          <List
            items={w.movingUp}
            empty="Refresh your rankings to see movers."
            render={(r) => (
              <li key={r.keyword} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <span className="min-w-0 truncate text-gray-800">{r.keyword}</span>
                <span className="shrink-0 text-xs tabular-nums text-gray-600">{r.isNew ? `new at ${pos(r.position)}` : `${pos(r.previous)} → ${pos(r.position)}`}</span>
              </li>
            )}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Top pages from Google</h3>
          <List
            items={w.topPages}
            empty="No page data yet."
            render={(p) => (
              <li key={p.page} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <span className="min-w-0 truncate text-gray-800">{String(p.page).replace(/^https?:\/\/[^/]+/, "") || "/"}</span>
                <span className="shrink-0 text-xs tabular-nums text-gray-600">{formatNumber(p.clicks)} clicks</span>
              </li>
            )}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Best social posts</h3>
          <List
            items={w.topPosts}
            empty="No published posts with stats yet."
            render={(p) => (
              <li key={p.id} className="flex flex-col gap-0.5 py-1.5 text-sm">
                <span className="line-clamp-2 text-gray-800">{p.text}</span>
                <span className="text-xs tabular-nums text-gray-600">
                  {serviceInfo(p.service).label} · {formatNumber(p.impressions)} impressions · {formatNumber(p.engagementRate, "percentage")} engaged
                </span>
              </li>
            )}
          />
        </div>
      </div>
    </Section>
  );
}

function Trending({ data }) {
  const t = data.trending;
  return (
    <Section id="trending" title="What's trending" description="Growing demand, new searches and competitors on the rise.">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rising searches in your niche</h3>
          <List
            items={t.risingSearches}
            empty="Refresh keyword demand (Focus → paid checks) to see what's growing."
            render={(d) => (
              <li key={d.keyword} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 text-sm">
                <span className="min-w-0 truncate text-gray-800">
                  {d.keyword}
                  {d.ourPosition == null && <span className="ml-2 text-xs text-gray-500">you don&apos;t rank</span>}
                </span>
                <span className="flex flex-wrap items-center gap-3 text-xs tabular-nums text-gray-600">
                  <Sparkline values={d.monthly} label={`${d.keyword}, monthly searches`} width={72} height={20} />
                  {formatNumber(d.volume)}/mo
                  <span className="w-12 text-right">+{d.trend}%</span>
                  <AddToPipeline keyword={d.keyword} volume={d.volume} />
                </span>
              </li>
            )}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">New searches finding you</h3>
          <List
            items={t.newSearches}
            empty="Nothing new this period."
            render={(q) => (
              <li key={q.query} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <span className="min-w-0 truncate text-gray-800">{q.query}</span>
                <span className="shrink-0 text-xs tabular-nums text-gray-600">
                  {formatNumber(q.impressions)} impr. · {pos(q.position)}
                </span>
              </li>
            )}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Competitors on the move</h3>
          <List
            items={t.competitorMovers}
            empty="Needs two visibility snapshots to compare."
            render={(c) => (
              <li key={c.domain} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <span className="min-w-0 truncate text-gray-800">{c.domain}</span>
                <span className="shrink-0 text-xs tabular-nums text-gray-600">
                  <Change value={c.change} suffix="%" invert /> traffic
                </span>
              </li>
            )}
          />
        </div>
        {t.aiQuestions.length > 0 && (
          <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Questions people ask AI assistants</h3>
            <List
              items={t.aiQuestions}
              empty=""
              render={(q) => (
                <li key={q.question} className="flex flex-col gap-0.5 py-1.5 text-sm">
                  <span className="text-gray-800">{q.question}</span>
                  {q.brands.length > 0 && <span className="text-xs text-gray-600">Answers name: {q.brands.join(", ")}</span>}
                </li>
              )}
            />
          </div>
        )}
      </div>
    </Section>
  );
}

function Competitors({ data }) {
  const rows = data.competitors;
  return (
    <Section
      id="competitors"
      title="You vs competitors"
      description="Estimated Google traffic, share, page-one keywords and links."
      action={
        <Button size="sm" variant="ghost" asChild>
          <Link href="/keywords?tab=competitors">
            Details <ArrowRight />
          </Link>
        </Button>
      }
    >
      {!rows.length ? (
        <Empty href="/focus" cta="Run the growth check">
          Pick competitors in Search &amp; market, then refresh competitor visibility.
        </Empty>
      ) : (
        <div className="relative -mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">You and tracked competitors</caption>
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th scope="col" className="py-2 pr-4 font-medium">Site</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Traffic/mo</th>
                <th scope="col" className="py-2 pr-4 font-medium">Trend</th>
                <th scope="col" className="py-2 pr-4 font-medium">Share</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Page-one keywords</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Referring domains</th>
                <th scope="col" className="py-2 text-right font-medium">Niche visibility</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.domain} className={cn("border-b border-gray-100 last:border-0", r.you && "bg-primary-soft/60")}>
                  <th scope="row" className="py-2.5 pr-4 text-left font-medium text-gray-900">
                    {r.domain} {r.you && <Badge className="ml-1">You</Badge>}
                  </th>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-gray-800">
                    {formatNumber(r.traffic)} <Change value={r.change} suffix="%" />
                  </td>
                  <td className="py-2.5 pr-4">
                    <Sparkline values={r.trend} label={`${r.domain} traffic`} />
                  </td>
                  <td className="py-2.5 pr-4">
                    <ShareBar value={r.share} you={r.you} />
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-gray-800">{formatNumber(r.top10)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-gray-800">{formatNumber(r.referringDomains)}</td>
                  <td className="py-2.5 text-right tabular-nums text-gray-800">{r.nicheVisibility != null ? `${r.nicheVisibility}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* --- Page ------------------------------------------------------------------ */

export default async function Dashboard() {
  const session = await auth();
  const now = new Date();
  const in14 = new Date(now.getTime() + 14 * 864e5);
  const [data, todo, autopilot, upcoming, setup] = await Promise.all([
    safe(dashboardData(), null),
    safe(notifications(), { items: [], count: 0, urgent: 0 }),
    safe(getAutopilot(), { enabled: false, perRun: 3 }),
    safe(listPosts({ start: now.toISOString(), end: in14.toISOString(), statuses: ["scheduled", "sending", "error"] }), null),
    safe(setupStatus(), []),
  ]);
  const remaining = setup.filter((s) => !s.done);
  const name = session?.user?.name ? `, ${session.user.name.split(/[ .]/)[0].replace(/^./, (c) => c.toUpperCase())}` : "";

  return (
    <>
      <PageHeader
        title={`${greeting()}${name}`}
        description="Your numbers, what needs you today, and where you could rank higher."
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
                  {s.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> : <Circle className="mt-0.5 size-4 shrink-0 text-gray-400" />}
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

      {data ? <Kpis data={data} /> : <Empty>Couldn&apos;t load the numbers. Check Settings.</Empty>}
      {data?.website.error && <p className="-mt-4 text-xs text-destructive">Website reports: {data.website.error}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <NeedsYou todo={todo} autopilot={autopilot} />
        <TargetsPanel compact />
      </div>

      {data && (
        <>
          <NotRanking data={data} />
          <div className="grid gap-6 xl:grid-cols-2">
            <Working data={data} />
            <Trending data={data} />
          </div>
          <Competitors data={data} />
        </>
      )}

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
            <Empty href="/review" cta="Review queue">
              Nothing scheduled. Approve and schedule drafts from the review queue.
            </Empty>
          ) : (
            upcoming.slice(0, 6).map((post) => <PostRow key={post.id} post={post} />)
          )}
        </CardContent>
      </Card>
    </>
  );
}
