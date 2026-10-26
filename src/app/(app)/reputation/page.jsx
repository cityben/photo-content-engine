import { Info, Star } from "lucide-react";

import { Empty, LinkTabs, NotConnected, SectionCard } from "@/components/market-cards";
import { AddIdeaButton, ListEditor, RefreshButton, TaskWatcher, TextSetting } from "@/components/market-ui";
import { PageHeader } from "@/components/shell/app-shell";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { reviewStats } from "@/lib/seo/analysis";
import { dataforseoConfigured, isSandbox } from "@/lib/seo/dataforseo";
import { getMarketSettings, latest } from "@/lib/seo/market";
import { pendingTasks } from "@/lib/seo/presence";
import { formatNumber } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reputation & authority — Content Engine" };

const TABS = [
  ["reviews", "Reviews"],
  ["mentions", "Brand mentions"],
  ["ai", "AI answers"],
  ["links", "Backlinks"],
  ["health", "Site health"],
];

function Stars({ value, className }) {
  if (value == null) return <span className="text-gray-400">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", className)} aria-label={`${value} out of 5`}>
      <Star className="size-3.5 fill-amber-400 text-amber-500" aria-hidden />
      {Number(value).toFixed(1)}
    </span>
  );
}

function Bar({ value, max, tone = "bg-primary" }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <span className={cn("block h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
    </span>
  );
}

function shortDate(value) {
  if (!value) return "";
  return new Date(String(value).replace(" +00:00", "Z").replace(" ", "T")).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/* --- Reviews --------------------------------------------------------------- */

function ReviewList({ reviews }) {
  if (!reviews.length) return <Empty>No reviews returned.</Empty>;
  return (
    <ul className="flex flex-col gap-3">
      {reviews.slice(0, 30).map((r, i) => (
        <li key={r.url || i} className="flex flex-col gap-1.5 rounded-lg bg-gray-50 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <Stars value={r.rating} className="font-semibold text-gray-900" />
            <span>{r.author}</span>
            <span>·</span>
            <span>{shortDate(r.date)}</span>
            {r.replied ? <Badge variant="success">Replied</Badge> : (r.rating ?? 5) <= 3 ? <Badge variant="destructive">Needs a reply</Badge> : <Badge variant="secondary">No reply</Badge>}
          </div>
          {r.title && <p className="font-medium text-gray-900">{r.title}</p>}
          {r.text && <p className="max-w-[75ch] text-sm leading-6 text-gray-700">{r.text}</p>}
          {r.reply && <p className="max-w-[75ch] border-l-2 border-gray-200 pl-3 text-xs leading-5 text-gray-600">Your reply: {r.reply}</p>}
          {r.url && (
            <a href={r.url} target="_blank" rel="noreferrer" className="w-fit text-xs font-medium text-primary hover:underline">
              Open review
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function ReviewSource({ title, snap, section, pending }) {
  const reviews = snap?.data?.reviews || [];
  const stats = reviewStats(reviews);
  const max = Math.max(1, ...stats.distribution.map((d) => d.count));
  return (
    <SectionCard
      title={title}
      description={snap?.data?.title ? `Reviews for “${snap.data.title}”.` : "Fetches your latest reviews. It runs in DataForSEO's queue, so results take a minute or two."}
      snap={snap}
      action={<RefreshButton section={section} label={pending ? "Queued…" : "Fetch reviews"} disabled={pending} />}
    >
      {!snap ? (
        <Empty>Not fetched yet.</Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-3xl font-bold tabular-nums text-gray-900">{snap.data.rating ?? stats.average ?? "—"}</p>
              <p className="text-xs text-gray-600">{formatNumber(snap.data.total)} reviews in total</p>
            </div>
            <p className="text-xs text-gray-500">Breakdown of the latest {reviews.length} fetched</p>
            <ul className="-mt-2 flex flex-col gap-1.5" aria-label="Rating distribution">
              {stats.distribution.map((d) => (
                <li key={d.star} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 text-xs text-gray-600">
                  <span>{d.star}★</span>
                  <Bar value={d.count} max={max} tone={d.star >= 4 ? "bg-marker" : d.star === 3 ? "bg-amber-400" : "bg-red-400"} />
                  <span className="text-right tabular-nums">{d.count}</span>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-gray-50 p-2">
                <dt className="text-gray-500">Last 90 days</dt>
                <dd className="text-base font-semibold tabular-nums text-gray-900">{stats.last90}</dd>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <dt className="text-gray-500">Replied to</dt>
                <dd className="text-base font-semibold tabular-nums text-gray-900">{stats.repliedShare != null ? `${stats.repliedShare}%` : "—"}</dd>
              </div>
            </dl>
            {stats.unanswered > 0 && <p className="rounded-lg bg-destructive-soft p-3 text-xs text-destructive">{stats.unanswered} low-rated {stats.unanswered === 1 ? "review has" : "reviews have"} no reply. Reply calmly and factually — buyers read the replies.</p>}
          </div>
          <ReviewList reviews={reviews} />
        </div>
      )}
    </SectionCard>
  );
}

async function ReviewsTab() {
  const settings = await getMarketSettings();
  const [profiles, google, trustpilot, pending] = await Promise.all([latest("profiles"), latest("reviews", "google"), latest("reviews", "trustpilot"), pendingTasks()]);
  const rows = profiles?.data || [];
  const ours = rows.find((r) => r.you);
  const best = rows.filter((r) => !r.you && r.found).sort((a, b) => b.reviews - a.reviews)[0];
  const queued = (source) => pending.some((t) => t.source === source);

  return (
    <>
      <TaskWatcher count={pending.length} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Google rating" value={ours?.rating != null ? ours.rating.toFixed(1) : "—"} hint={ours ? `${formatNumber(ours.reviews)} reviews` : "Refresh profiles"} />
        <StatTile label="Rival with most reviews" value={best ? formatNumber(best.reviews) : "—"} hint={best ? best.title || best.name : "Add rivals below"} />
        <StatTile label="Trustpilot" value={trustpilot?.data?.rating ?? "—"} hint={trustpilot ? `${formatNumber(trustpilot.data.total)} reviews` : "Not fetched"} />
        <StatTile label="Profile photos" value={ours ? formatNumber(ours.photos) : "—"} hint="Job photos belong here too" />
      </div>

      <SectionCard
        title="Google Business profiles"
        description="Your profile next to local rivals. More recent reviews and photos lift you in the map pack — the box people see before the normal results."
        snap={profiles}
        action={<RefreshButton section="profiles" label="Refresh profiles" variant="default" />}
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            {rows.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead className="text-right">Rating</TableHead>
                    <TableHead className="text-right">Reviews</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Photos</TableHead>
                    <TableHead className="hidden lg:table-cell">Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.name} className={r.you ? "bg-primary-soft/50" : undefined}>
                      <TableCell className="font-medium text-gray-900">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {r.title || r.name} {r.you && <Badge>You</Badge>}
                          {!r.found && <Badge variant="secondary">Not found</Badge>}
                          {r.claimed === false && <Badge variant="destructive">Unclaimed</Badge>}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Stars value={r.rating} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(r.reviews)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNumber(r.photos)}</TableCell>
                      <TableCell className="hidden text-xs lg:table-cell">{r.category || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty>Press Refresh profiles.</Empty>
            )}
            {ours?.topics?.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-gray-900">What your reviewers talk about</p>
                <div className="flex flex-wrap gap-1.5">
                  {ours.topics.map((t) => (
                    <span key={t.topic} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                      {t.topic} <span className="tabular-nums text-gray-500">{t.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-4 rounded-lg bg-gray-50 p-4">
            <TextSetting key={settings.brand} field="brand" value={settings.brand} label="Your business name on Google" />
            <TextSetting key={settings.location} field="location" value={settings.location} label="Area" hint="DataForSEO location name, e.g. London,England,United Kingdom" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-700">Local rivals (business names)</span>
              <ListEditor key={settings.rivals.join("|")} field="rivals" values={settings.rivals} placeholder="e.g. Rival Air Conditioning Ltd" label="Add a rival business" max={8} />
            </div>
          </div>
        </div>
      </SectionCard>

      <ReviewSource title="Google reviews" snap={google} section="reviews-google" pending={queued("google")} />
      <ReviewSource title="Trustpilot reviews" snap={trustpilot} section="reviews-trustpilot" pending={queued("trustpilot")} />
    </>
  );
}

/* --- Mentions -------------------------------------------------------------- */

const TONE = { positive: "success", negative: "destructive", neutral: "secondary" };

async function MentionsTab() {
  const { brand } = await getMarketSettings();
  const snap = await latest("mentions");
  const d = snap?.data;
  const tones = Object.entries(d?.tones || {});
  const toneTotal = tones.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <SectionCard
      title={`Where “${brand}” is mentioned`}
      description="Pages across the web that name you — news, directories, supplier and client sites. Un-linked mentions are the easiest backlinks you'll ever get: ask for the link."
      snap={snap}
      action={<RefreshButton section="mentions" label="Find mentions" variant="default" />}
    >
      {!d ? (
        <Empty>Press Find mentions.</Empty>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Mentions found" value={formatNumber(d.total)} className="bg-gray-50 shadow-none" />
            {tones.slice(0, 3).map(([k, v]) => (
              <StatTile key={k} label={`${k} tone`} value={`${Math.round((v / toneTotal) * 100)}%`} className="bg-gray-50 shadow-none" />
            ))}
          </div>
          {d.mentions.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="hidden md:table-cell">Tone</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Site authority</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.mentions.slice(0, 60).map((m) => (
                  <TableRow key={m.url}>
                    <TableCell className="max-w-xl">
                      <a href={m.url} target="_blank" rel="noreferrer" className="font-medium text-gray-900 hover:text-primary hover:underline">
                        {m.title || m.domain}
                      </a>
                      <p className="text-xs text-gray-500">{m.domain}</p>
                      {m.snippet && <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">{m.snippet}</p>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{m.tone && <Badge variant={TONE[m.tone] || "secondary"}>{m.tone}</Badge>}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{m.domainRank ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-right text-xs">{shortDate(m.date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>No mentions outside your own site yet.</Empty>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/* --- AI answers ------------------------------------------------------------ */

async function AiTab() {
  const snap = await latest("ai");
  const d = snap?.data;
  const rows = [...(d?.rows || [])].sort((a, b) => b.mentions - a.mentions);
  const max = Math.max(1, ...rows.map((r) => r.mentions));
  const ours = rows.find((r) => r.you);
  return (
    <>
      <SectionCard
        title="Do AI assistants recommend you?"
        description="How often your domain is cited in Google's AI Overviews and ChatGPT answers, next to the competitors you track. More buyers now ask an assistant before they search."
        snap={snap}
        action={<RefreshButton section="ai" label="Check AI answers" variant="default" />}
      >
        {!d ? (
          <Empty>Press Check AI answers. It compares you with up to three tracked competitors.</Empty>
        ) : (
          <div className="flex flex-col gap-6">
            <ul className="flex flex-col gap-3">
              {rows.map((r) => (
                <li key={r.domain} className="grid gap-1.5 sm:grid-cols-[14rem_1fr_auto] sm:items-center sm:gap-4">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                    {r.domain} {r.you && <Badge>You</Badge>}
                  </span>
                  <Bar value={r.mentions} max={max} tone={r.you ? "bg-primary" : "bg-gray-400"} />
                  <span className="text-xs tabular-nums text-gray-600">
                    {d.platforms.map((p) => `${p.label.split(" (")[0]} ${formatNumber(r.platforms[p.key] || 0)}`).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
            {ours?.sources?.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900">Sites AI answers cite alongside you</p>
                <p className="mb-2 text-xs text-gray-600">Getting listed or featured on these makes you more likely to be named.</p>
                <div className="flex flex-wrap gap-1.5">
                  {ours.sources.map((s) => (
                    <span key={s.domain} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                      {s.domain} <span className="tabular-nums text-gray-500">{s.mentions}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>
      {d?.questions?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Questions where AI names you</CardTitle>
            <CardDescription>Real prompts and the brands named in the answer. Write case studies that answer these directly.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead className="text-right">AI searches/mo</TableHead>
                  <TableHead className="hidden lg:table-cell">Also named</TableHead>
                  <TableHead className="sr-only">Add to pipeline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.questions.map((q) => (
                  <TableRow key={q.question}>
                    <TableCell className="max-w-md font-medium text-gray-900">{q.question}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(q.volume)}</TableCell>
                    <TableCell className="hidden text-xs lg:table-cell">{q.brands.join(", ") || "—"}</TableCell>
                    <TableCell className="text-right">
                      <AddIdeaButton title={q.question.charAt(0).toUpperCase() + q.question.slice(1)} source="ai-question" detail="Asked of AI assistants" format="article" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/* --- Backlinks ------------------------------------------------------------- */

async function LinksTab() {
  const { competitors } = await getMarketSettings();
  const [summary, gap] = await Promise.all([latest("backlinks"), latest("linkgap")]);
  const rows = [...(summary?.data || [])].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
  const ours = rows.find((r) => r.you);
  const prospects = gap?.data?.prospects || [];
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Domain authority" value={ours?.rank ?? "—"} hint="DataForSEO rank, 0–100" />
        <StatTile label="Referring domains" value={ours ? formatNumber(ours.referringDomains) : "—"} hint="Sites linking to you" />
        <StatTile label="Broken backlinks" value={ours ? formatNumber(ours.broken) : "—"} hint="Links to pages that 404 — redirect them" />
        <StatTile label="Link prospects" value={gap ? formatNumber(prospects.length) : "—"} hint={gap ? `Link to ${gap.data.targets.join(" & ")}` : "Find them below"} />
      </div>
      <SectionCard
        title="Authority vs competitors"
        description="Links from other sites are Google's main trust signal. Referring domains matter more than raw link counts."
        snap={summary}
        action={<RefreshButton section="backlinks" label="Refresh backlinks" variant="default" />}
      >
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead className="text-right">Authority</TableHead>
                <TableHead className="text-right">Referring domains</TableHead>
                <TableHead className="hidden text-right md:table-cell">Backlinks</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Broken</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Spam score</TableHead>
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
                  <TableCell className="text-right tabular-nums">{r.rank ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.referringDomains)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNumber(r.backlinks)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatNumber(r.broken)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{r.spamScore ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty>Press Refresh backlinks. It compares you with up to six tracked competitors (Search & market → Competitors).</Empty>
        )}
      </SectionCard>
      <SectionCard
        title="Link prospects"
        description="Sites that link to two of your competitors but not to you — trade bodies, directories, suppliers, local press. If they link to both of them, they'll consider you."
        snap={gap}
        action={<RefreshButton section="linkgap" label="Find prospects" disabled={competitors.length < 2} />}
      >
        {prospects.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead className="text-right">Authority</TableHead>
                <TableHead className="hidden md:table-cell">Links to</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Links</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospects.slice(0, 100).map((p) => (
                <TableRow key={p.domain}>
                  <TableCell>
                    <a href={`https://${p.domain}`} target="_blank" rel="noreferrer" className="font-medium text-gray-900 hover:text-primary hover:underline">
                      {p.domain}
                    </a>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.rank}</TableCell>
                  <TableCell className="hidden text-xs md:table-cell">{p.linksTo.join(", ")}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatNumber(p.backlinks)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty>{competitors.length < 2 ? "Track at least two competitors on Search & market first." : "Press Find prospects."}</Empty>
        )}
      </SectionCard>
    </>
  );
}

/* --- Site health ----------------------------------------------------------- */

const SEVERITY = { high: "destructive", medium: "default", low: "secondary" };

async function HealthTab() {
  const { auditUrls } = await getMarketSettings();
  const snap = await latest("audit");
  const pages = snap?.data || [];
  const scored = pages.filter((p) => p.score != null);
  const avg = scored.length ? Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length) : null;
  const high = pages.reduce((s, p) => s + p.issues.filter((i) => i.severity === "high").length, 0);
  const slow = pages.filter((p) => p.lcp != null && p.lcp > 2500).length;
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Average page score" value={avg ?? "—"} hint="DataForSEO on-page score, 0–100" />
        <StatTile label="Pages checked" value={snap ? pages.length : "—"} />
        <StatTile label="Serious issues" value={snap ? high : "—"} accent={high ? "text-destructive" : undefined} />
        <StatTile label="Slow pages" value={snap ? slow : "—"} hint="Largest paint over 2.5s" />
      </div>
      <SectionCard
        title="Page check"
        description="Checks your key pages the way Google's crawler sees them: titles, headings, content, speed and broken basics. With no pages listed, it checks the homepage and your top-ranking pages."
        snap={snap}
        action={<RefreshButton section="audit" label="Check pages" variant="default" />}
      >
        <div className="flex flex-col gap-6">
          {pages.length ? (
            <ul className="flex flex-col gap-3">
              {pages.map((p) => (
                <li key={p.url} className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <a href={p.url} target="_blank" rel="noreferrer" className="min-w-0 truncate font-medium text-gray-900 hover:text-primary hover:underline">
                      {p.url.replace(/^https:\/\/(www\.)?/, "")}
                    </a>
                    {p.score != null && (
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", p.score >= 90 ? "bg-marker-soft text-green-800" : p.score >= 70 ? "bg-gray-100 text-gray-800" : "bg-destructive-soft text-destructive")}>
                        {p.score}/100
                      </span>
                    )}
                  </div>
                  {p.error ? (
                    <p className="text-sm text-destructive">{p.error}</p>
                  ) : (
                    <>
                      <p className="text-xs text-gray-600">
                        {[
                          p.status && `HTTP ${p.status}`,
                          p.titleLength != null && `title ${p.titleLength} chars`,
                          p.descriptionLength != null && `description ${p.descriptionLength} chars`,
                          p.words != null && `${formatNumber(p.words)} words`,
                          p.lcp != null && `LCP ${(p.lcp / 1000).toFixed(1)}s`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {p.h1 && <p className="text-xs text-gray-600">H1: {p.h1}</p>}
                      {p.issues.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {p.issues.map((i) => (
                            <Badge key={i.key} variant={SEVERITY[i.severity]}>
                              {i.label}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <Badge variant="success">No issues found</Badge>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Press Check pages.</Empty>
          )}
          <div className="flex flex-col gap-1 rounded-lg bg-gray-50 p-4">
            <span className="text-sm font-semibold text-gray-900">Pages to check (optional, up to 10)</span>
            <ListEditor key={auditUrls.join("|")} field="auditUrls" values={auditUrls} placeholder="https://www.example.co.uk/services/air-conditioning" label="Add a page URL" max={10} />
          </div>
        </div>
      </SectionCard>
    </>
  );
}

export default async function ReputationPage({ searchParams }) {
  const params = (await searchParams) || {};
  const tab = TABS.some(([id]) => id === params.tab) ? params.tab : "reviews";
  const connected = dataforseoConfigured();
  return (
    <>
      <PageHeader
        title="Reputation & authority"
        description="What buyers see when they check you out: reviews, who mentions you, whether AI assistants recommend you, your backlinks and the health of your key pages."
        actions={connected && isSandbox() && <Badge variant="secondary">DataForSEO sandbox · dummy data</Badge>}
      />
      <LinkTabs base="/reputation" tabs={TABS} active={tab} label="Reputation sections" />
      {!connected ? (
        <NotConnected />
      ) : (
        <>
          {tab === "reviews" && <ReviewsTab />}
          {tab === "mentions" && <MentionsTab />}
          {tab === "ai" && <AiTab />}
          {tab === "links" && <LinksTab />}
          {tab === "health" && <HealthTab />}
          <p className="flex items-start gap-1.5 text-xs text-gray-500">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Data from DataForSEO. Each refresh is a paid request (usually cents); this month&apos;s spend and budget are on the Settings page.
          </p>
        </>
      )}
    </>
  );
}
