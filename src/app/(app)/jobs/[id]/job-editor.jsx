"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Copy, Loader2, PenLine, RotateCcw, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Recommendations, SeoPanel } from "@/components/insight-panels";
import { JobDetailsFields } from "@/components/job-details-fields";
import { money } from "@/lib/ui-labels";
import { PhotoUploader } from "@/components/photo-uploader";
import { useCopy } from "@/components/use-copy";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { APPROVABLE, blankContent, mainImageOf, needsApproval, orderedImages } from "@/lib/content";
import { formatDateTime } from "@/lib/time";

import { ApprovalBar } from "./approval-bar";
import { CaseStudyForm } from "./case-study-form";
import { SocialComposer } from "./social-composer";

const TABS = [
  { id: "linkedin", label: "LinkedIn", section: "linkedin" },
  { id: "instagram", label: "Instagram", section: "instagram" },
  { id: "caseStudy", label: "Case study", section: "caseStudy" },
  { id: "googleBusiness", label: "Google Business", section: "googleBusiness" },
  { id: "seo", label: "Keywords", section: "seo" },
  { id: "tips", label: "Tips", section: "recommendations" },
  { id: "brief", label: "Photos & brief" },
];

function RewriteDialog({ job, tab, onDone, models }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("tab");
  const [instructions, setInstructions] = useState("");
  const [model, setModel] = useState("default");
  const [busy, setBusy] = useState(false);
  const section = TABS.find((t) => t.id === tab)?.section;
  const written = Boolean(job.generatedAt || job.content?.linkedin || job.content?.caseStudy);

  const run = async () => {
    setBusy(true);
    try {
      const { job: updated } = await api(`/api/jobs/${job.id}/generate`, {
        method: "POST",
        body: {
          ...(scope === "tab" && section ? { sections: [section] } : {}),
          ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
          ...(model !== "default" ? { model } : {}),
        },
      });
      onDone(updated);
      toast.success("Rewritten.");
      setOpen(false);
      setInstructions("");
    } catch (e) {
      toast.error(`Rewrite failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles /> {written ? "Rewrite" : "Write content"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{written ? "Rewrite with AI" : "Write content with AI"}</DialogTitle>
          <DialogDescription>Unsaved edits in the rewritten parts are replaced.</DialogDescription>
        </DialogHeader>
        {written && section && (
          <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
            {[
              { id: "tab", label: `Just ${TABS.find((t) => t.id === tab).label}` },
              { id: "all", label: "Everything" },
            ].map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={scope === o.id}
                onClick={() => setScope(o.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring ${scope === o.id ? "bg-white text-gray-900 shadow-paper" : "text-gray-600"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="instructions">Instructions (optional)</Label>
          <Textarea
            id="instructions"
            placeholder="e.g. Shorter. Lead with the weekend crane lift. Mention we kept the tenant running."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            maxLength={1000}
          />
        </div>
        {models && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="rewrite-model">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="rewrite-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default — {models.active}</SelectItem>
                {models.shortlist
                  .filter((m) => m.id !== models.active && m.available !== false)
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} · {m.score}/10{m.perJob != null ? ` · ≈${money(m.perJob)}/job` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">Try another model on this job to compare. You can restore the previous version afterwards.</p>
          </div>
        )}
        <DialogFooter>
          <Button onClick={run} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {busy ? "Writing…" : "Rewrite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GoogleBusiness({ data, onChange }) {
  const { copied, copy } = useCopy();
  const text = data?.text || "";
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-gray-600">
        Post this on your Google Business Profile (Buffer can&apos;t schedule it from here). Regular updates with photos help you show up in local &quot;near me&quot; searches.
      </p>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="gbp">Post</Label>
          <span className="text-xs tabular-nums text-gray-500">{text.length}/1,500</span>
        </div>
        <Textarea id="gbp" className="min-h-48" value={text} onChange={(e) => onChange({ ...data, text: e.target.value })} />
      </div>
      <Button variant="outline" className="self-start" onClick={() => copy(text, "Google Business post copied")} disabled={!text}>
        {copied ? <Check /> : <Copy />} Copy
      </Button>
    </div>
  );
}

export function JobEditor({ initialJob, social, posts, websiteConnected, models, startManual }) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [content, setContent] = useState(() => {
    const c = initialJob.content || {};
    // Manual start: blank sections to type into (anything imported is kept).
    return startManual ? blankContent(initialJob, c) : c;
  });
  const [brief, setBrief] = useState({
    title: initialJob.title,
    writeUp: initialJob.writeUp,
    details: initialJob.details || {},
    images: initialJob.images || [],
    mainImage: mainImageOf(initialJob)?.url || null,
  });
  const [dirty, setDirty] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const hasContent = (c) => Boolean(c && (c.linkedin || c.instagram || c.caseStudy));
  const [tab, setTab] = useState(() =>
    startManual && initialJob.source === "word" ? "caseStudy" : startManual || hasContent(initialJob.content) ? "linkedin" : "brief"
  );
  const [selected, setSelected] = useState(() => ({
    linkedin: orderedImages(initialJob).slice(0, 1).map((i) => i.url),
    instagram: orderedImages(initialJob).slice(0, 10).map((i) => i.url),
  }));

  const markDirty = (key) => setDirty((d) => new Set(d).add(key));
  const setSection = (key) => (value) => {
    setContent((c) => ({ ...c, [key]: value }));
    markDirty(key);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {};
      const changed = [...dirty];
      const contentKeys = changed.filter((k) => k !== "brief");
      if (contentKeys.length) body.content = Object.fromEntries(contentKeys.map((k) => [k, content[k]]));
      if (dirty.has("brief")) Object.assign(body, brief);
      const { job: updated } = await api(`/api/jobs/${job.id}`, { method: "PATCH", body });
      setJob(updated);
      setDirty(new Set());
      toast.success("Saved.");
      router.refresh();
    } catch (e) {
      toast.error(`Couldn't save: ${e.message}`);
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const onRewritten = (updated) => {
    setJob(updated);
    setContent(updated.content || {});
    setDirty((d) => new Set([...d].filter((k) => k === "brief")));
    if (tab === "brief") setTab("linkedin");
    router.refresh();
  };

  const restorePrevious = async () => {
    const { model: _model, ...sections } = job.previousContent || {};
    try {
      const { job: updated } = await api(`/api/jobs/${job.id}`, { method: "PATCH", body: { content: sections } });
      setJob({ ...updated, previousContent: null });
      setContent(updated.content || {});
      toast.success("Previous version restored.");
      router.refresh();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const lastRun = job.aiRuns?.at(-1);
  const totalCost = (job.aiRuns || []).reduce((sum, r) => sum + (r.costUsd || 0), 0);

  const remove = async () => {
    try {
      await api(`/api/jobs/${job.id}`, { method: "DELETE" });
      toast.success("Job deleted. Scheduled posts stay in Buffer.");
      router.push("/jobs");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const postsFor = (service) => posts.filter((p) => p.service === service);
  const writeManually = () => {
    setContent((c) => blankContent(job, c));
    if (tab === "brief") setTab("linkedin");
  };
  const aiWrote = (section) => (job.aiRuns || []).some((r) => r.sections?.includes(section));
  const approvalProps = (section) => ({
    job,
    section,
    data: content[section],
    dirty: dirty.has(section),
    onSave: save,
    onChanged: (updated) => {
      setJob(updated);
      router.refresh();
    },
    aiWritten: aiWrote(section),
  });
  const pending = needsApproval({ ...job, content });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{job.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {job.generatedAt ? (
              <span>
                Written {formatDateTime(job.generatedAt)}
                {lastRun && ` by ${lastRun.model}${lastRun.costUsd != null ? ` · ${money(lastRun.costUsd, 3)}` : ""}`}
                {job.aiRuns?.length > 1 && totalCost > 0 && ` · ${money(totalCost, 3)} across ${job.aiRuns.length} runs`}
              </span>
            ) : (
              !hasContent(content) && <Badge variant="secondary">Not written yet</Badge>
            )}
            {job.searchDataUsed && <Badge variant="success">Uses Search Console data</Badge>}
            {pending.length > 0 && <Badge variant="secondary">{pending.length} to approve</Badge>}
            {posts.length > 0 && <Badge>{posts.length} scheduled</Badge>}
            {job.website?.projectId && <Badge variant="success">Case study draft on website</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {dirty.size > 0 && (
            <Button onClick={() => save().catch(() => {})} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Save changes
            </Button>
          )}
          {job.previousContent && (
            <Button variant="ghost" onClick={restorePrevious} title={job.previousContent.model ? `Back to the ${job.previousContent.model} version` : undefined}>
              <RotateCcw /> Restore previous
            </Button>
          )}
          <RewriteDialog job={job} tab={tab} onDone={onRewritten} models={models} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Delete job">
                <Trash2 />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                <AlertDialogDescription>
                  Removes the photos and written content from this app. Posts already in Buffer and any case study on the website are not touched — delete those from the calendar or website admin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>Delete job</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
                {APPROVABLE.includes(t.section) && job.approvals?.[t.section] && !dirty.has(t.section) && (
                  <CheckCircle2 aria-label="approved" className="size-3.5 text-primary" />
                )}
                {dirty.has(t.section || "brief") && <span aria-label="unsaved" className="size-1.5 rounded-full bg-marker" />}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <Card className="mt-2">
          <CardContent>
            {!hasContent(content) && tab !== "brief" ? (
              <div className="flex flex-col items-start gap-3 rounded-lg bg-gray-50 p-6">
                <p className="text-sm text-gray-600">Nothing written yet. Draft it with AI, or write it yourself — either way you approve it before it goes out.</p>
                <div className="flex flex-wrap gap-2">
                  <RewriteDialog job={job} tab={tab} onDone={onRewritten} models={models} />
                  <Button variant="outline" onClick={writeManually}>
                    <PenLine /> Write it myself
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <TabsContent value="linkedin">
                  <ApprovalBar {...approvalProps("linkedin")} />
                  <SocialComposer
                    approved={Boolean(job.approvals?.linkedin)}
                    dirty={dirty.has("linkedin")}
                    service="linkedin"
                    data={content.linkedin}
                    onChange={setSection("linkedin")}
                    job={job}
                    social={social}
                    posts={postsFor("linkedin")}
                    selectedImages={selected.linkedin}
                    onSelectImages={(urls) => setSelected((s) => ({ ...s, linkedin: urls }))}
                  />
                </TabsContent>
                <TabsContent value="instagram">
                  <ApprovalBar {...approvalProps("instagram")} />
                  <SocialComposer
                    approved={Boolean(job.approvals?.instagram)}
                    dirty={dirty.has("instagram")}
                    service="instagram"
                    data={content.instagram}
                    onChange={setSection("instagram")}
                    job={job}
                    social={social}
                    posts={postsFor("instagram")}
                    selectedImages={selected.instagram}
                    onSelectImages={(urls) => setSelected((s) => ({ ...s, instagram: urls.slice(0, 10) }))}
                  />
                </TabsContent>
                <TabsContent value="caseStudy">
                  <ApprovalBar {...approvalProps("caseStudy")} />
                  <CaseStudyForm
                    approved={Boolean(job.approvals?.caseStudy)}
                    job={job}
                    data={content.caseStudy}
                    onChange={setSection("caseStudy")}
                    websiteConnected={websiteConnected}
                    dirty={dirty.has("caseStudy")}
                    onSave={save}
                  />
                </TabsContent>
                <TabsContent value="googleBusiness">
                  <ApprovalBar {...approvalProps("googleBusiness")} />
                  <GoogleBusiness data={content.googleBusiness} onChange={setSection("googleBusiness")} />
                </TabsContent>
                <TabsContent value="seo">
                  <SeoPanel seo={content.seo} searchDataUsed={job.searchDataUsed} />
                </TabsContent>
                <TabsContent value="tips">
                  <Recommendations items={content.recommendations} />
                </TabsContent>
              </>
            )}
            <TabsContent value="brief">
              <div className="flex flex-col gap-6">
                <PhotoUploader
                  images={brief.images}
                  mainUrl={brief.mainImage}
                  onMainChange={(mainImage) => {
                    setBrief((b) => ({ ...b, mainImage }));
                    markDirty("brief");
                  }}
                  onChange={(images) => {
                    setBrief((b) => ({ ...b, images }));
                    markDirty("brief");
                  }}
                />
                <div className="flex flex-col gap-2">
                  <Label htmlFor="brief-title">Job title</Label>
                  <Input id="brief-title" value={brief.title} onChange={(e) => { setBrief((b) => ({ ...b, title: e.target.value })); markDirty("brief"); }} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="brief-writeup">Write-up</Label>
                  <Textarea id="brief-writeup" className="min-h-40" value={brief.writeUp} onChange={(e) => { setBrief((b) => ({ ...b, writeUp: e.target.value })); markDirty("brief"); }} />
                </div>
                <JobDetailsFields value={brief.details} onChange={(details) => { setBrief((b) => ({ ...b, details })); markDirty("brief"); }} />
                <p className="text-xs text-gray-500">After changing the brief, save, then use Rewrite → Everything to update the content.</p>
              </div>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
