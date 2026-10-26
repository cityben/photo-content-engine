import Link from "next/link";
import { Info } from "lucide-react";

import { LinkTabs, NotConnected, SectionCard } from "@/components/market-cards";
import { KeywordTable, LinesChart, ListEditor, RefreshButton, TrackButton, TrendsForm } from "@/components/market-ui";
import { PageHeader } from "@/components/shell/app-shell";
import { parseDays } from "@/components/range-picker";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dataforseoConfigured, isSandbox } from "@/lib/seo/dataforseo";
import { getMarketSettings, history, latest } from "@/lib/seo/market";
import { formatNumber } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

import { SearchTab } from "./search-tab";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search & market — Content Engine" };

const TABS = [
  ["search", "Your search"],
  ["competitors", "Competitors"],
  ["keywords", "Keyword ideas"],
  ["trends", "Trends"],
];

function Delta({ value, invert }) {
  if (!value) return <span className="text-gray-400">—</span>;
  const good = invert ? value < 0 : value > 0;
  return (
    <span className={cn("tabular-nums", good ? "text-primary" : "text-destructive")}>
      {value > 0 ? "+" : ""}
      {formatNumber(value)}
    </span>
  );
}

async function CompetitorsTab({ selected }) {
  const settings = await getMarketSettings();
  const [overview, overviewHistory, discovered, leaders] = await Promise.all([
    latest("overview"),
    history("overview"),
    latest("competitors"),
    latest("leaders"),
  ]);
  const focus = selected && settings.competitors.includes(selected) ? selected : settings.competitors[0];
  const [gap, theirs] = focus ? await Promise.all([latest("gap", focus), latest("ranked", focus)]) : [null, null];

  const rows = [...(overview?.data || [])].sort((a, b) => b.traffic - a.traffic);
  const ours = rows.find((r) => r.you);
  const rank = ours ? rows.indexOf(ours) + 1 : null;
  const chartDomains = rows.slice(0, 8).map((r) => r.domain);
  const chart = overviewHistory.map((snap) => ({
    date: new Date(snap.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    ...Object.fromEntries(snap.data.filter((r) => chartDomains.includes(r.domain)).map((r) => [r.domain, r.traffic])),
  }));
  const gapRows = gap?.data || [];
  const gapWins = gapRows.filter((r) => ["commercial", "transactional"].includes(r.intent) && (r.difficulty ?? 0) < 40);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Your est. monthly traffic" value={ours ? formatNumber(ours.traffic) : "—"} hint="Organic, from Google UK" />
        <StatTile label="Rank among tracked" value={rank ? `${rank} of ${rows.length}` : "—"} hint="By organic traffic" />
        <StatTile label="Your top-10 keywords" value={ours ? formatNumber(ours.top10) : "—"} hint={ours ? `${formatNumber(ours.top3)} in the top 3` : undefined} />
        <StatTile label={focus ? `Gap vs ${focus}` : "Keyword gap"} value={gap ? formatNumber(gapRows.length) : "—"} hint={gap ? `${gapWins.length} easy buying keywords` : "Refresh a competitor below"} />
      </div>

      <SectionCard
        title="Who you're up against"
        description="You and the competitors you track, side by side. Each refresh adds a point to the history, so you can see who is growing."
        snap={overview}
        action={<RefreshButton section="overview" label="Refresh visibility" variant="default" />}
      >
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <div className="min-w-0">
              {rows.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead className="text-right">Traffic/mo</TableHead>
                      <TableHead className="text-right">Keywords</TableHead>
                      <TableHead className="text-right">Top 3</TableHead>
                      <TableHead className="hidden text-right md:table-cell">Top 10</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">New</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">Lost</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.domain} className={r.you ? "bg-primary-soft/50" : undefined}>
                        <TableCell className="font-medium text-gray-900">
                          <span className="flex items-center gap-1.5">
                            {r.domain} {r.you && <Badge>You</Badge>}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.traffic)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.keywords)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.top3)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNumber(r.top10)}</TableCell>
                        <TableCell className="hidden text-right lg:table-cell">
                          <Delta value={r.newKeywords} />
                        </TableCell>
                        <TableCell className="hidden text-right lg:table-cell">
                          <Delta value={-r.lostKeywords} />
                        </TableCell>
                        <TableCell className="text-right">
                          {!r.you && (
                            <Link href={`/keywords?tab=competitors&c=${encodeURIComponent(r.domain)}#gap`} className="text-xs font-medium text-primary hover:underline">
                              Gap →
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">
                  {settings.competitors.length ? "Press Refresh visibility to compare." : "Find competitors below first, or add the ones you know."}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">Tracked competitors</p>
              <p className="text-xs text-gray-600">Up to 15. These are compared above and used for gaps.</p>
              <ListEditor key={settings.competitors.join("|")} field="competitors" values={settings.competitors} placeholder="competitor.co.uk" label="Add a competitor domain" />
            </div>
          </div>
          {chart.length > 1 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-gray-900">Estimated organic traffic over time</p>
              <LinesChart data={chart} series={chartDomains} />
            </div>
          )}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Competitors Google sees"
          description="Domains that rank for the same keywords as you, by overlap. Track the ones that matter."
          snap={discovered}
          action={<RefreshButton section="competitors" label="Find competitors" />}
        >
          {discovered?.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead className="text-right">Shared keywords</TableHead>
                  <TableHead className="text-right">Their traffic</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {discovered.data.slice(0, 20).map((r) => (
                  <TableRow key={r.domain}>
                    <TableCell className="font-medium text-gray-900">{r.domain}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.sharedKeywords)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.traffic)}</TableCell>
                    <TableCell className="text-right">
                      <TrackButton domain={r.domain} tracked={settings.competitors} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">Press Find competitors. If you track none yet, the top 6 are tracked for you.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Niche leaders"
          description="Who owns Google for your service keywords — including big players who don't overlap with you yet. Uses your seed keywords."
          snap={leaders}
          action={<RefreshButton section="leaders" label="Refresh leaders" />}
        >
          {leaders?.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead className="text-right">Avg position</TableHead>
                  <TableHead className="text-right">Keywords</TableHead>
                  <TableHead className="text-right">Visibility</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaders.data.slice(0, 20).map((r) => (
                  <TableRow key={r.domain} className={r.you ? "bg-primary-soft/50" : undefined}>
                    <TableCell className="font-medium text-gray-900">
                      <span className="flex items-center gap-1.5">
                        {r.domain} {r.you && <Badge>You</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.avgPosition ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.keywordsCount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.visibility != null ? `${r.visibility}%` : "—"}</TableCell>
                    <TableCell className="text-right">{!r.you && <TrackButton domain={r.domain} tracked={settings.competitors} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">Press Refresh leaders.</p>
          )}
        </SectionCard>
      </div>

      {settings.competitors.length > 0 && (
        <div id="gap" className="flex scroll-mt-6 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Competitor:</span>
            {settings.competitors.map((d) => (
              <Link
                key={d}
                href={`/keywords?tab=competitors&c=${encodeURIComponent(d)}#gap`}
                aria-current={d === focus ? "true" : undefined}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                  d === focus ? "bg-primary text-white" : "bg-white text-gray-700 shadow-paper hover:text-gray-900"
                )}
              >
                {d}
              </Link>
            ))}
          </div>

          <SectionCard
            title={`Keyword gap: ${focus}`}
            description="Searches they rank for and you don't. Buying intent and low difficulty first — each one is a case study or service page waiting to be written."
            snap={gap}
            action={<RefreshButton section="gap" domain={focus} label="Refresh gap" variant="default" />}
          >
            <KeywordTable
              rows={gapRows}
              extra={[
                { key: "theirPosition", label: "Their position", kind: "position", sort: "theirPosition", className: "text-right" },
                { key: "theirUrl", label: "Their page", kind: "url", className: "hidden xl:table-cell" },
              ]}
              emptyText="Press Refresh gap to see what they rank for that you don't."
              pipeline={{ source: "gap", detail: `${focus} ranks for this; you don't` }}
            />
          </SectionCard>

          <SectionCard
            title={`What ${focus} ranks for`}
            description="Their best keywords by traffic, and which page earns it. Arrows show movement since Google's last update."
            snap={theirs}
            action={<RefreshButton section="ranked" domain={focus} label="Refresh their keywords" />}
          >
            <KeywordTable
              rows={theirs?.data || []}
              initialSort="traffic"
              extra={[
                { key: "position", label: "Position", kind: "position", sort: "position", className: "text-right" },
                { key: "traffic", label: "Traffic", kind: "number", sort: "traffic", className: "text-right" },
                { key: "url", label: "Page", kind: "url", className: "hidden xl:table-cell" },
              ]}
              emptyText="Press Refresh their keywords."
              pipeline={{ source: "gap", detail: `Earns ${focus} traffic` }}
            />
          </SectionCard>
        </div>
      )}
    </>
  );
}

async function KeywordsTab() {
  const settings = await getMarketSettings();
  const [ideas, ours] = await Promise.all([latest("ideas"), latest("ranked", settings.domain)]);
  const rows = ideas?.data || [];
  const rising = rows.filter((r) => (r.trend ?? 0) > 20 && r.volume >= 50).length;
  const unranked = rows.filter((r) => !r.ourPosition && ["commercial", "transactional"].includes(r.intent)).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Keyword ideas" value={ideas ? formatNumber(rows.length) : "—"} hint="Around your services, UK" />
        <StatTile label="Rising fast" value={ideas ? formatNumber(rising) : "—"} hint="+20% year on year" />
        <StatTile label="Buying keywords you miss" value={ideas ? formatNumber(unranked) : "—"} hint="Not in your top 100" />
        <StatTile label="You rank for" value={ours ? formatNumber(ours.data.length) : "—"} hint="Top keywords tracked" />
      </div>

      <SectionCard
        title="What your market is searching for"
        description="Demand around your services in the UK — not just searches you already appear for. Score weighs volume, value (CPC), buying intent, difficulty and momentum."
        snap={ideas}
        action={<RefreshButton section="ideas" label="Refresh ideas" variant="default" />}
      >
        <KeywordTable
          rows={rows}
          extra={[{ key: "ourPosition", label: "You", kind: "position", sort: "ourPosition", className: "text-right" }]}
          emptyText="Press Refresh ideas. Refresh your own keywords first and each idea shows where you already rank."
          pipeline={{ source: "ideas", detail: "UK search demand around your services" }}
        />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <SectionCard
          title={`What ${settings.domain} ranks for`}
          description="Your own keywords by estimated traffic. Positions 4–20 are the cheapest wins."
          snap={ours}
          action={<RefreshButton section="ranked" domain={settings.domain} label="Refresh yours" />}
        >
          <KeywordTable
            rows={ours?.data || []}
            initialSort="traffic"
            extra={[
              { key: "position", label: "Position", kind: "position", sort: "position", className: "text-right" },
              { key: "url", label: "Page", kind: "url", className: "hidden xl:table-cell" },
            ]}
            emptyText="Press Refresh yours."
          />
        </SectionCard>
        <Card>
          <CardHeader>
            <CardTitle>Seed keywords</CardTitle>
            <CardDescription>The services ideas and niche leaders grow from. Keep them to what you sell.</CardDescription>
          </CardHeader>
          <CardContent>
            <ListEditor key={settings.seeds.join("|")} field="seeds" values={settings.seeds} placeholder="e.g. daikin vrv installer" label="Add a seed keyword" max={50} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

async function TrendsTab() {
  // Trends snapshots are keyed by keyword list; show the newest of any.
  const snap = await latest("trends", null);
  const keywords = snap?.data?.keywords || ["air conditioning installation", "heat pump installation", "commercial electrician"];
  const points = (snap?.data?.points || []).map((p) => ({ ...p, date: new Date(p.date).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) }));

  return (
    <SectionCard
      title="Seasonality and momentum"
      description="Google Trends interest over five years in the UK (100 = the peak). Plan content a month before the curve rises — air conditioning peaks in summer, heating in autumn."
      snap={snap}
    >
      <div className="flex flex-col gap-6">
        <TrendsForm initial={keywords} />
        {points.length ? (
          <>
            <LinesChart data={points} series={snap.data.keywords} height={300} />
            {snap.data.averages?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {snap.data.keywords.map((k, i) => (
                  <span key={k} className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    {k}: average interest <span className="font-semibold tabular-nums">{snap.data.averages[i] ?? "—"}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">Pick up to five keywords and press Compare.</p>
        )}
      </div>
    </SectionCard>
  );
}

export default async function KeywordsPage({ searchParams }) {
  const params = (await searchParams) || {};
  const tab = TABS.some(([id]) => id === params.tab) ? params.tab : "search";
  const days = parseDays(params.days);
  const connected = dataforseoConfigured();

  return (
    <>
      <PageHeader
        title="Search & market"
        description="Where you rank, who you're up against, and what your market is searching for — so every case study targets demand that exists."
        actions={connected && isSandbox() && <Badge variant="secondary">DataForSEO sandbox · dummy data</Badge>}
      />
      <LinkTabs base="/keywords" tabs={TABS} active={tab} label="Search & market sections" />

      {tab === "search" && <SearchTab days={days} />}
      {tab !== "search" && !connected && <NotConnected />}
      {tab === "competitors" && connected && <CompetitorsTab selected={params.c} />}
      {tab === "keywords" && connected && <KeywordsTab />}
      {tab === "trends" && connected && <TrendsTab />}

      {tab !== "search" && connected && (
        <p className="flex items-start gap-1.5 text-xs text-gray-500">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Market data is from DataForSEO (Google UK). Traffic is an estimate from rankings and search volumes, good for comparing domains — not a replacement for your own analytics.
        </p>
      )}
    </>
  );
}
