import { AlertCircle, Info } from "lucide-react";

import { ChannelChip } from "@/components/post-row";
import { PageHeader } from "@/components/shell/app-shell";
import { parseDays, RangePicker } from "@/components/range-picker";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { growthData, socialReferrals } from "@/lib/growth";
import { dayKey, formatDateTime } from "@/lib/time";
import { formatNumber } from "@/lib/ui-labels";

import { ImpressionsChart } from "./impressions-chart";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics — Content Engine" };

const metricValue = (metrics, type) => metrics?.find((m) => m.type === type)?.value;

function buildSeries(posts, days) {
  const metric = posts.some((p) => metricValue(p.metrics, "impressions") != null) ? "impressions" : "reactions";
  const buckets = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    buckets.set(dayKey(d), { day: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d), linkedin: 0, instagram: 0 });
  }
  for (const p of posts) {
    const b = buckets.get(dayKey(p.sentAt || p.dueAt));
    if (b && (p.service === "linkedin" || p.service === "instagram")) b[p.service] += Number(metricValue(p.metrics, metric)) || 0;
  }
  return { metric, data: [...buckets.values()] };
}

function KpiChange({ kpi, invert }) {
  if (kpi?.change == null) return null;
  const good = invert ? kpi.change < 0 : kpi.change > 0;
  return (
    <span className={good ? "text-primary" : "text-destructive"}>
      {kpi.change > 0 ? "+" : ""}
      {Math.round(kpi.change)}% vs previous
    </span>
  );
}

export default async function AnalyticsPage({ searchParams }) {
  const days = parseDays((await searchParams)?.days);
  const data = await growthData({ days });
  const social = data.social;
  const totals = social?.totals || [];
  const series = social ? buildSeries(social.posts, days) : null;
  const top = social
    ? [...social.posts]
        .sort((a, b) => (metricValue(b.metrics, "impressions") || metricValue(b.metrics, "reactions") || 0) - (metricValue(a.metrics, "impressions") || metricValue(a.metrics, "reactions") || 0))
        .slice(0, 8)
    : [];
  const kpis = data.website.summary?.kpis;
  const referrals = socialReferrals(data.website.traffic);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How your posts are doing, and the traffic and search results behind them."
        actions={<RangePicker days={days} basePath="/analytics" />}
      />

      {social?.simulated && (
        <p className="flex items-start gap-2 rounded-xl bg-white p-4 text-sm text-gray-700 shadow-paper">
          <Info className="mt-0.5 size-4 shrink-0 text-gray-500" />
          Sandbox mode: these social numbers are simulated so you can try the screens. Connect Buffer in Settings for real figures.
        </p>
      )}
      {data.socialError && (
        <p className="flex items-start gap-2 rounded-xl bg-destructive-soft p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> Couldn&apos;t load Buffer stats: {data.socialError}
        </p>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="social-heading">
        <div className="flex items-center gap-2">
          <h2 id="social-heading" className="text-lg font-semibold text-gray-900">Social</h2>
          {social?.simulated && <Badge variant="secondary">Simulated</Badge>}
          {social?.metricsUpdatedAt && !social.simulated && <span className="text-xs text-gray-500">Buffer updated {formatDateTime(social.metricsUpdatedAt)} · refreshes daily</span>}
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Posts published" value={social ? social.posts.length : "—"} />
          <StatTile label="Impressions" value={formatNumber(metricValue(totals, "impressions"))} />
          <StatTile label="Reactions + comments" value={formatNumber((metricValue(totals, "reactions") || metricValue(totals, "likes") || 0) + (metricValue(totals, "comments") || 0))} />
          <StatTile label="Engagement rate" value={formatNumber(metricValue(totals, "engagementRate"), "percentage")} hint="Engaged ÷ impressions" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{series?.metric === "impressions" ? "Impressions" : "Reactions"} by publish day</CardTitle>
            <CardDescription>Each post&apos;s lifetime total, on the day it went out.</CardDescription>
          </CardHeader>
          <CardContent>
            {series && social.posts.length ? (
              <ImpressionsChart data={series.data} metricLabel={series.metric} />
            ) : (
              <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">
                No posts went out through Buffer in this range.{!social?.simulated && " Buffer only reports posts published through Buffer — anything posted straight on LinkedIn or Instagram won't show here. Schedule from a job or the calendar and its numbers appear the day after it goes out."}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>By channel</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead className="text-right">Posts</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                    <TableHead className="text-right">Engagement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(social?.perChannel || []).map((c) => (
                    <TableRow key={c.channel.id}>
                      <TableCell>
                        <ChannelChip service={c.channel.service} name={c.channel.name} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.postCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(metricValue(c.metrics, "impressions"))}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(metricValue(c.metrics, "engagementRate"), "percentage")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top posts</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {top.length === 0 && <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">Nothing published in this range.</p>}
              {top.map((p) => (
                <div key={p.id} className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ChannelChip service={p.service} />
                      <span className="text-xs text-gray-500">{formatDateTime(p.sentAt || p.dueAt)}</span>
                    </div>
                    <p className="line-clamp-2 text-sm text-gray-700">{p.text}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end text-xs text-gray-600">
                    <span className="text-sm font-semibold tabular-nums text-gray-900">{formatNumber(metricValue(p.metrics, "impressions") ?? metricValue(p.metrics, "reactions"))}</span>
                    <span>{metricValue(p.metrics, "impressions") != null ? "impressions" : "reactions"}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="web-heading">
        <h2 id="web-heading" className="text-lg font-semibold text-gray-900">Website</h2>
        {!data.website.configured ? (
          <p className="rounded-xl bg-white p-6 text-sm text-gray-600 shadow-paper">
            Connect the website (WEBSITE_API_KEY with analytics:read) to see visitors, Google search clicks and the traffic your posts send to the site.
          </p>
        ) : data.website.error ? (
          <p className="rounded-xl bg-destructive-soft p-4 text-sm text-destructive">Couldn&apos;t load website reports: {data.website.error}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile label="Website users" value={formatNumber(kpis?.users?.now)} hint={<KpiChange kpi={kpis?.users} />} />
              <StatTile label="Google search clicks" value={formatNumber(kpis?.gscClicks?.now)} hint={<KpiChange kpi={kpis?.gscClicks} />} />
              <StatTile label="Avg search position" value={kpis?.gscPosition?.now != null ? kpis.gscPosition.now.toFixed(1) : "—"} hint={<KpiChange kpi={kpis?.gscPosition} invert />} />
              <StatTile label="Enquiries" value={formatNumber(kpis?.enquiries?.now)} hint={<KpiChange kpi={kpis?.enquiries} />} />
            </div>
            {data.website.summary?.narrative && (
              <Card>
                <CardContent>
                  <p className="text-sm leading-6 text-gray-700">{Array.isArray(data.website.summary.narrative) ? data.website.summary.narrative.join(" ") : data.website.summary.narrative}</p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Visits from social</CardTitle>
                <CardDescription>GA4 sessions from LinkedIn, Instagram and other social sources — the clicks your posts actually earn.</CardDescription>
              </CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">No social visits recorded in this range. Put the case study link in the first comment of each post.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source / medium</TableHead>
                        <TableHead className="text-right">Sessions</TableHead>
                        <TableHead className="text-right">Users</TableHead>
                        <TableHead className="text-right">Key events</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referrals.map((r) => (
                        <TableRow key={r.key}>
                          <TableCell className="font-medium text-gray-900">{r.key}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.sessions)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.users)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.keyEvents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </>
  );
}
