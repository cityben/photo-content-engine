import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const IMPACT = { high: "default", medium: "secondary", low: "secondary" };

export function SeoPanel({ seo, searchDataUsed }) {
  if (!seo) return <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">Not written yet.</p>;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-gray-500" />
        <div className="flex flex-col gap-2">
          <p className="text-sm leading-6 text-gray-700">{seo.rankingNotes}</p>
          {!searchDataUsed && (
            <p className="text-xs text-gray-500">
              These are AI estimates. Connect the website in Settings and the next rewrite uses your real Google Search Console positions, clicks and impressions.
            </p>
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Keyword</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead className="hidden md:table-cell">Why</TableHead>
            <TableHead className="hidden lg:table-cell">Use it in</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {seo.keywords.map((k) => (
            <TableRow key={k.keyword}>
              <TableCell className="align-top">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-gray-900">{k.keyword}</span>
                  <span className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{k.intent}</Badge>
                    <Badge variant={k.evidence === "search-console" ? "success" : "secondary"}>
                      {k.evidence === "search-console" ? "Search Console" : "Estimate"}
                    </Badge>
                  </span>
                  <span className="text-xs text-gray-600 md:hidden">{k.why}</span>
                </div>
              </TableCell>
              <TableCell className="align-top">
                <Badge variant={IMPACT[k.priority]}>{k.priority}</Badge>
              </TableCell>
              <TableCell className="hidden max-w-md align-top text-xs leading-5 md:table-cell">{k.why}</TableCell>
              <TableCell className="hidden max-w-xs align-top text-xs leading-5 lg:table-cell">{k.useIn}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {seo.internalLinks?.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-800">Internal links to add</p>
          <ul className="flex flex-col gap-1 text-sm text-gray-700">
            {seo.internalLinks.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      <Button variant="outline" size="sm" className="self-start" asChild>
        <Link href="/keywords">
          All search data <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}

const CATEGORY = { timing: "Timing", content: "Content", seo: "SEO", engagement: "Engagement", growth: "Growth", website: "Website", photos: "Photos" };

export function Recommendations({ items }) {
  if (!items?.length) return <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">Not written yet.</p>;
  const order = { high: 0, medium: 1, low: 2 };
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {[...items].sort((a, b) => order[a.impact] - order[b.impact]).map((r) => (
        <li key={r.title} className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={r.impact === "high" ? "default" : "secondary"}>{r.impact} impact</Badge>
            <Badge variant="secondary">{CATEGORY[r.category] || r.category}</Badge>
          </div>
          <p className="text-sm font-semibold text-gray-900">{r.title}</p>
          <p className="text-sm leading-6 text-gray-600">{r.detail}</p>
        </li>
      ))}
    </ul>
  );
}
