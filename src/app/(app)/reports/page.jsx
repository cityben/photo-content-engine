import Link from "next/link";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";

import { Empty } from "@/components/market-cards";
import { PageHeader } from "@/components/shell/app-shell";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CSV_KINDS, isMonth, KPI_LABELS, recentMonths, reportData, savedSummary } from "@/lib/reports";
import { formatDateTime } from "@/lib/time";
import { formatNumber, money } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

import { CsvMenu, PrintButton, WriteSummaryButton } from "./report-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monthly report — Content Engine" };

const IMPACT = { high: "destructive", medium: "default", low: "secondary" };

function Change({ kpi, invert }) {
  if (kpi?.change == null) return kpi?.noData ? "No data" : "—";
  const up = kpi.change > 0;
  const good = invert ? !up : up;
  return (
    <span className={cn("tabular-nums", kpi.change === 0 ? "text-gray-500" : good ? "text-primary" : "text-destructive")}>
      {up ? "▲" : kpi.change < 0 ? "▼" : ""} {Math.abs(Math.round(kpi.change))}% vs previous
    </span>
  );
}

function Section({ title, description, children }) {
  return (
    <Card className="print-avoid-break">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MonthNav({ month }) {
  const months = recentMonths(13);
  const i = months.indexOf(month);
  const newer = i > 0 ? months[i - 1] : null;
  const older = i >= 0 && i < months.length - 1 ? months[i + 1] : null;
  const label = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  const linkClass = "inline-flex size-9 items-center justify-center rounded-md bg-white shadow-paper outline-none hover:bg-gray-50 focus-visible:ring-[3px] focus-visible:ring-ring";
  return (
    <div className="flex items-center gap-1 print:hidden">
      {older ? (
        <Link href={`/reports?month=${older}`} className={linkClass} aria-label={`Previous month, ${label(older)}`}>
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span className={cn(linkClass, "opacity-40")} aria-hidden>
          <ChevronLeft className="size-4" />
        </span>
      )}
      <span className="min-w-24 text-center text-sm font-medium text-gray-900">{label(month)}</span>
      {newer ? (
        <Link href={`/reports?month=${newer}`} className={linkClass} aria-label={`Next month, ${label(newer)}`}>
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={cn(linkClass, "opacity-40")} aria-hidden>
          <ChevronRight className="size-4" />
        </span>
      )}
    </div>
  );
}

export default async function ReportsPage({ searchParams }) {
  const params = (await searchParams) || {};
  const month = isMonth(params.month) && recentMonths(13).includes(params.month) ? params.month : recentMonths(1)[0];
  const [data, summary] = await Promise.all([reportData(month), savedSummary(month)]);
  const aiReady = Boolean(process.env.VERCEL || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
  const k = data.website?.kpis || {};
  const kpiIds = Object.keys(KPI_LABELS).filter((id) => k[id] && !k[id].noData);
  const s = data.social;
  const topPosts = [...(s?.posts || [])].sort((a, b) => (b.impressions ?? b.reactions ?? 0) - (a.impressions ?? a.reactions ?? 0)).slice(0, 5);

  return (
    <>
      <PageHeader
        title={`Growth report — ${data.range.label}`}
        description={`${data.range.from} to ${data.range.to}${data.range.partial ? " (month to date)" : ""}. Website, search, social, work shipped, market and reputation in one place.`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <MonthNav month={month} />
            <WriteSummaryButton month={month} hasSummary={Boolean(summary)} disabled={!aiReady} />
            <PrintButton />
            <CsvMenu month={month} kinds={CSV_KINDS} />
          </div>
        }
      />

      <Section title="Executive summary" description={summary ? `Written ${formatDateTime(summary.createdAt)} by ${summary.run?.model || "AI"} from the numbers below.` : undefined}>
        {summary ? (
          <div className="flex flex-col gap-5">
            <p className="text-lg font-semibold leading-7 text-gray-900">{summary.headline}</p>
            <p className="max-w-[75ch] text-sm leading-6 text-gray-700">{summary.summary}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-marker-soft p-4">
                <p className="mb-2 text-sm font-semibold text-gray-900">Wins</p>
                <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-gray-800">
                  {summary.wins.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="mb-2 text-sm font-semibold text-gray-900">Concerns</p>
                {summary.concerns.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-gray-800">
                    {summary.concerns.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600">None flagged.</p>
                )}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-gray-900">Next month</p>
              <ol className="flex flex-col gap-2">
                {summary.nextMonth.map((a, i) => (
                  <li key={a.title} className="flex gap-3 rounded-lg bg-gray-50 p-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{i + 1}</span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900">
                        {a.title} <Badge variant={IMPACT[a.impact]}>{a.impact} impact</Badge>
                      </p>
                      <p className="max-w-[75ch] text-sm leading-6 text-gray-600">{a.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <Empty>{aiReady ? "Press Write summary for a directors' read of the month, written from the numbers below." : "Connect the AI Gateway to write a summary. The numbers below work without it."}</Empty>
        )}
      </Section>

      <Section title="Website and search" description={data.website ? data.website.narrative || "From the website's GA4, Search Console and Business Profile data." : undefined}>
        {!data.website ? (
          <Empty>Connect the website (Settings) to include traffic, search and enquiries.</Empty>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {kpiIds.map((id) => (
                <StatTile
                  key={id}
                  label={KPI_LABELS[id]}
                  value={id === "gscPosition" ? (k[id].now != null ? k[id].now.toFixed(1) : "—") : formatNumber(k[id].now)}
                  hint={<Change kpi={k[id]} invert={id === "gscPosition"} />}
                  className="bg-gray-50 shadow-none"
                />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="min-w-0">
                <p className="mb-2 text-sm font-semibold text-gray-900">Top search queries</p>
                {data.website.queries.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Query</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">Impr.</TableHead>
                        <TableHead className="text-right">Pos.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.website.queries.slice(0, 10).map((q) => (
                        <TableRow key={q.key}>
                          <TableCell className="font-medium text-gray-900">{q.key}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(q.clicks)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(q.impressions)}</TableCell>
                          <TableCell className="text-right tabular-nums">{q.position != null ? q.position.toFixed(1) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Empty>No Search Console rows for this month.</Empty>
                )}
              </div>
              <div className="min-w-0">
                <p className="mb-2 text-sm font-semibold text-gray-900">Top landing pages</p>
                {data.website.landingPages.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Page</TableHead>
                        <TableHead className="text-right">Sessions</TableHead>
                        <TableHead className="text-right">Key events</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.website.landingPages.slice(0, 10).map((p) => (
                        <TableRow key={p.key}>
                          <TableCell className="max-w-64 truncate font-medium text-gray-900">{p.key}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(p.sessions)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(p.keyEvents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Empty>No landing page data.</Empty>
                )}
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section title="Social" description={s?.simulated ? "Sandbox — these are simulated numbers, not real posts." : "From Buffer. Buffer refreshes post metrics daily."}>
        {!s ? (
          <Empty>Social data unavailable.</Empty>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Posts published" value={formatNumber(s.totals.posts)} className="bg-gray-50 shadow-none" />
              <StatTile label="Impressions" value={formatNumber(s.totals.impressions)} className="bg-gray-50 shadow-none" />
              <StatTile label="Reactions" value={formatNumber(s.totals.reactions)} className="bg-gray-50 shadow-none" />
              <StatTile label="Visits from social" value={formatNumber(data.website?.socialReferrals?.reduce((sum, r) => sum + r.sessions, 0) ?? null)} hint="Website sessions, GA4" className="bg-gray-50 shadow-none" />
            </div>
            {topPosts.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900">Best posts</p>
                <ul className="flex flex-col gap-2">
                  {topPosts.map((p, i) => (
                    <li key={i} className="flex items-start justify-between gap-4 rounded-lg bg-gray-50 p-3 text-sm">
                      <span className="min-w-0">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{p.service}</span>
                        <span className="line-clamp-2 text-gray-800">{p.text}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs tabular-nums text-gray-600">
                        {formatNumber(p.impressions ?? p.reactions)} {p.impressions != null ? "impr." : "reactions"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Work shipped">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Jobs created" value={data.work.jobsCreated.length} className="bg-gray-50 shadow-none" />
          <StatTile label="Case studies sent" value={data.work.caseStudiesSent.length} hint="As website drafts" className="bg-gray-50 shadow-none" />
          <StatTile label="Ideas published" value={data.work.ideasPublished.length} hint={`${data.work.ideasWaiting} waiting in the pipeline`} className="bg-gray-50 shadow-none" />
          <StatTile label="Tool running costs" value={money(data.work.aiCostUsd + data.work.dataCostUsd)} hint={`AI ${money(data.work.aiCostUsd)} · data ${money(data.work.dataCostUsd)}`} className="bg-gray-50 shadow-none" />
        </div>
        {data.work.caseStudiesSent.length > 0 && (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {data.work.caseStudiesSent.map((j) => (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="text-primary hover:underline">
                  {j.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-8 xl:grid-cols-2">
        <Section title="Market" description={data.market ? `Estimated organic traffic, DataForSEO snapshot of ${formatDateTime(data.market.at)}${data.market.comparedWith ? `, change since ${formatDateTime(data.market.comparedWith)}` : ""}.` : undefined}>
          {data.market ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead className="text-right">Traffic/mo</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Top 10</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...data.market.rows].sort((a, b) => b.traffic - a.traffic).map((r) => (
                  <TableRow key={r.domain} className={r.you ? "bg-primary-soft/50" : undefined}>
                    <TableCell className="font-medium text-gray-900">
                      {r.domain} {r.you && <Badge>You</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.traffic)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", r.trafficChange > 0 ? "text-primary" : r.trafficChange < 0 ? "text-destructive" : "")}>
                      {r.trafficChange == null ? "—" : `${r.trafficChange > 0 ? "+" : ""}${formatNumber(r.trafficChange)}`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.top10)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>Refresh visibility on Search & market → Competitors to include the market.</Empty>
          )}
        </Section>
        <Section title="Reputation">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Google rating" value={data.reputation.profile?.rating != null ? data.reputation.profile.rating.toFixed(1) : "—"} hint={data.reputation.profile ? `${formatNumber(data.reputation.profile.reviews)} reviews` : "Not fetched"} className="bg-gray-50 shadow-none" />
            <StatTile label="Referring domains" value={formatNumber(data.reputation.backlinks?.referringDomains ?? null)} hint={data.reputation.backlinks ? `Authority ${data.reputation.backlinks.rank ?? "—"}` : "Not fetched"} className="bg-gray-50 shadow-none" />
            <StatTile label="AI answer mentions" value={formatNumber(data.reputation.ai?.mentions ?? null)} hint="Google AI + ChatGPT" className="bg-gray-50 shadow-none" />
            <StatTile label="Photos on profile" value={formatNumber(data.reputation.profile?.photos ?? null)} className="bg-gray-50 shadow-none" />
          </div>
        </Section>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-gray-500">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Market and reputation figures are the latest DataForSEO snapshots taken up to the end of the month — refresh them on their pages before writing the report. Download PDF opens your browser&apos;s print dialog; choose “Save as PDF”.
      </p>
    </>
  );
}
