import Link from "next/link";
import { Info } from "lucide-react";

import { Empty, Freshness, LinkTabs, NotConnected } from "@/components/market-cards";
import { PageHeader } from "@/components/shell/app-shell";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AREA_PRESETS, CATEGORY_PRESETS, dueFollowUps, LEAD_STAGES, latestSearch, listLeads } from "@/lib/leads";
import { dataforseoConfigured } from "@/lib/seo/dataforseo";
import { cn } from "@/lib/utils";

import { LeadSearchForm, ManualLeadForm, SearchResults } from "./leads-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads — Content Engine" };

const TABS = [
  ["pipeline", "Pipeline"],
  ["find", "Find leads"],
];

const STAGE_TONE = { new: "secondary", contacted: "default", replied: "default", meeting: "success", won: "success", lost: "destructive" };

const shortDate = (d) => (d ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");

async function PipelineTab({ stage }) {
  const leads = await listLeads();
  const due = dueFollowUps(leads);
  const count = (id) => leads.filter((l) => l.status === id).length;
  const shown = stage ? leads.filter((l) => l.status === stage) : leads.filter((l) => l.status !== "lost");
  const drafts = leads.flatMap((l) => (l.drafts || []).filter((d) => !d.sentAt && !d.approved).map(() => l.id));

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Open leads" value={leads.filter((l) => !["won", "lost"].includes(l.status)).length} hint={`${count("new")} not contacted yet`} />
        <StatTile label="Follow-ups due" value={due.length} accent={due.length ? "text-destructive" : undefined} hint="Today or overdue" />
        <StatTile label="Meetings" value={count("meeting")} hint={`${count("replied")} replied`} />
        <StatTile label="Drafts to approve" value={drafts.length} hint="Nothing goes out unapproved" />
      </div>

      {due.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Follow up today</CardTitle>
            <CardDescription>Contacted five working days ago with no reply logged.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {due.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 p-3 text-sm">
                  <Link href={`/leads/${l.id}`} className="font-medium text-gray-900 hover:text-primary hover:underline">
                    {l.name}
                  </Link>
                  <span className="text-xs text-gray-600">due {shortDate(l.nextFollowUp)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Leads</CardTitle>
            <CardDescription>Open a lead to log calls, write outreach and set the next follow-up.</CardDescription>
          </div>
          <nav aria-label="Filter by stage" className="flex flex-wrap gap-1.5">
            <Link href="/leads" aria-current={!stage ? "true" : undefined} className={cn("rounded-full px-3 py-1 text-xs font-medium", !stage ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200")}>
              Open
            </Link>
            {LEAD_STAGES.map((s) => (
              <Link
                key={s.id}
                href={`/leads?stage=${s.id}`}
                aria-current={stage === s.id ? "true" : undefined}
                className={cn("rounded-full px-3 py-1 text-xs font-medium", stage === s.id ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200")}
              >
                {s.label} <span className="tabular-nums opacity-70">{count(s.id)}</span>
              </Link>
            ))}
          </nav>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {shown.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Fit</TableHead>
                  <TableHead className="hidden lg:table-cell">Contact</TableHead>
                  <TableHead className="text-right">Follow-up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link href={`/leads/${l.id}`} className="font-medium text-gray-900 hover:text-primary hover:underline">
                        {l.name}
                      </Link>
                      <p className="text-xs text-gray-500">{[l.category, l.city].filter(Boolean).join(" · ")}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STAGE_TONE[l.status]}>{LEAD_STAGES.find((s) => s.id === l.status)?.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{l.fit ?? "—"}</TableCell>
                    <TableCell className="hidden text-xs lg:table-cell">{l.contact?.name || "—"}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{shortDate(l.nextFollowUp)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>{leads.length ? "No leads at this stage." : "No leads yet. Find businesses on the Find leads tab, or add one you already know."}</Empty>
          )}
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="mb-2 text-sm font-medium text-gray-900">Add a lead you already know</p>
            <ManualLeadForm />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

async function FindTab() {
  const [search, leads] = await Promise.all([latestSearch(), listLeads()]);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Find businesses that buy building services</CardTitle>
          <CardDescription>Property managers, agents, main contractors and occupiers near you, from Google Maps. Bigger review counts usually mean bigger premises.</CardDescription>
        </CardHeader>
        <CardContent>
          <LeadSearchForm areas={AREA_PRESETS} categories={CATEGORY_PRESETS} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Results</CardTitle>
            {search && <CardDescription>{search.data.label} · {search.data.total} in Google&apos;s index</CardDescription>}
          </div>
          <Freshness snap={search} />
        </CardHeader>
        <CardContent>{search?.data?.rows?.length ? <SearchResults rows={search.data.rows} inPipeline={leads.map((l) => l.cid).filter(Boolean)} /> : <Empty>{search ? "No businesses matched. Widen the radius or pick other categories." : "Run a search."}</Empty>}</CardContent>
      </Card>
    </>
  );
}

export default async function LeadsPage({ searchParams }) {
  const params = (await searchParams) || {};
  const tab = params.tab === "find" ? "find" : "pipeline";
  const stage = LEAD_STAGES.some((s) => s.id === params.stage) ? params.stage : null;
  return (
    <>
      <PageHeader
        title="Leads"
        description="Find the businesses that buy what you do, write to them personally, and never miss a follow-up. Emails are drafted here and sent from your own inbox — only after you approve them."
      />
      <LinkTabs base="/leads" tabs={TABS} active={tab} label="Leads sections" />
      {tab === "pipeline" && <PipelineTab stage={stage} />}
      {tab === "find" && (dataforseoConfigured() ? <FindTab /> : <NotConnected />)}
      <p className="flex items-start gap-1.5 text-xs text-gray-500">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Business details are public Google Maps listings. Contact people at businesses for legitimate business reasons only, say who you are, and stop when asked (UK PECR/GDPR).
      </p>
    </>
  );
}
