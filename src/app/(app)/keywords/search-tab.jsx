import Link from "next/link";
import { Info, Lightbulb } from "lucide-react";

import { RangePicker } from "@/components/range-picker";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { growthData } from "@/lib/growth";
import { listJobs } from "@/lib/jobs";
import { formatNumber } from "@/lib/ui-labels";


/**
 * Why a query ranks where it does, in plain words, from its own numbers.
 * Search Console gives position, impressions and CTR — not the reasons — so
 * these are rules of thumb, labelled as such.
 */
function diagnosis(row) {
  const pos = row.position;
  const ctr = row.ctr ?? 0;
  if (pos == null) return "No position data.";
  if (pos <= 3) {
    return ctr < 0.05
      ? "Top 3 but few clicks — the title/description isn't winning the click. Rewrite the snippet."
      : "Strong. Protect it: keep the page fresh and linked from new case studies.";
  }
  if (pos <= 10) {
    return row.impressions > 100
      ? "Page 1 but below the fold. A case study on this exact topic, linked to the ranking page, can lift it into the top 3."
      : "Page 1 with low volume. Fine — focus effort elsewhere.";
  }
  if (pos <= 20) {
    return "Page 2: Google sees relevance but not authority. Quick win — add a case study and internal links using this phrase.";
  }
  return "Barely ranking. Needs a dedicated page or a case study built around it.";
}

function QuickWinBadge({ row }) {
  if (row.position > 3.5 && row.position <= 20 && row.impressions >= 50) return <Badge>Quick win</Badge>;
  return null;
}

export async function SearchTab({ days }) {
  const [data, jobs] = await Promise.all([growthData({ days }), listJobs()]);
  const q = data.website.queries;
  const rows = q?.rows || [];
  const wins = rows.filter((r) => r.position > 3.5 && r.position <= 20 && r.impressions >= 50).sort((a, b) => b.impressions - a.impressions);
  const aiKeywords = jobs.flatMap((j) => (j.content?.seo?.keywords || []).map((k) => ({ ...k, jobId: j.id, jobTitle: j.title }))).slice(0, 30);

  return (
    <>
      {data.website.configured && (
        <div className="flex justify-end">
          <RangePicker days={days} basePath="/keywords" extra="tab=search" />
        </div>
      )}

      {!data.website.configured || data.website.error ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect real search data</CardTitle>
            <CardDescription>
              {data.website.error
                ? `The website didn't return search data: ${data.website.error}`
                : "Your website already keeps a copy of Google Search Console. Give this tool a website API key with analytics:read to use it — then rankings here are real, not guesses."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/settings">How to connect</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Search queries" value={formatNumber(q.totalQueries)} hint={`Last ${days} days`} />
            {(q.bands || []).slice(0, 3).map((b) => (
              <StatTile key={b.key} label={b.key} value={formatNumber(b.queries)} hint="queries" />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="size-4 text-primary" /> Quick wins
              </CardTitle>
              <CardDescription>
                Positions 4–20 with real impressions. Google already links you to these searches; a focused case study and internal links can push them onto page 1.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {wins.length === 0 ? (
                <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">No quick wins in this range.</p>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {wins.slice(0, 8).map((r) => (
                    <li key={r.key} className="flex flex-col gap-1.5 rounded-lg bg-gray-50 p-4">
                      <p className="font-medium text-gray-900">{r.key}</p>
                      <p className="text-xs tabular-nums text-gray-600">
                        Position {r.position.toFixed(1)} · {formatNumber(r.impressions)} impressions · {formatNumber(r.clicks)} clicks
                      </p>
                      <p className="text-sm text-gray-600">{diagnosis(r)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All queries</CardTitle>
              <CardDescription className="flex items-start gap-1.5">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                From Google Search Console via your website. &quot;Why&quot; is a rule of thumb from position, impressions and click rate — Google doesn&apos;t publish its reasons.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead className="text-right">Position</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="hidden lg:table-cell">Why / what to do</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 100).map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium text-gray-900">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {r.key} <QuickWinBadge row={r} />
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.position != null ? r.position.toFixed(1) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.positionChange == null ? (
                          "—"
                        ) : (
                          <span className={r.positionChange > 0 ? "text-green-700" : r.positionChange < 0 ? "text-destructive" : ""}>
                            {r.positionChange > 0 ? "▲" : r.positionChange < 0 ? "▼" : ""} {Math.abs(r.positionChange).toFixed(1)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(r.impressions)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(r.clicks)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.ctr != null ? `${(r.ctr * 100).toFixed(1)}%` : "—"}</TableCell>
                      <TableCell className="hidden max-w-sm text-xs leading-5 lg:table-cell">{diagnosis(r)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Keywords suggested for your jobs</CardTitle>
          <CardDescription>From each job&apos;s AI write-up. &quot;Search Console&quot; means backed by your real data; &quot;Estimate&quot; means the AI&apos;s judgement.</CardDescription>
        </CardHeader>
        <CardContent>
          {aiKeywords.length === 0 ? (
            <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">Create a job to get keyword suggestions.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead className="hidden md:table-cell">Why</TableHead>
                  <TableHead>Job</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aiKeywords.map((k) => (
                  <TableRow key={`${k.jobId}-${k.keyword}`}>
                    <TableCell className="font-medium text-gray-900">{k.keyword}</TableCell>
                    <TableCell>
                      <Badge variant={k.evidence === "search-console" ? "success" : "secondary"}>{k.evidence === "search-console" ? "Search Console" : "Estimate"}</Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-md text-xs leading-5 md:table-cell">{k.why}</TableCell>
                    <TableCell>
                      <Link href={`/jobs/${k.jobId}`} className="text-xs font-medium text-primary hover:underline">
                        {k.jobTitle}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
