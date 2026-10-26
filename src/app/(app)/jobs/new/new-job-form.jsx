"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenLine, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { DocxImport } from "@/components/docx-import";
import { JobDetailsFields } from "@/components/job-details-fields";
import { PhotoUploader } from "@/components/photo-uploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export function NewJobForm({ idea = null }) {
  const router = useRouter();
  const [images, setImages] = useState([]);
  const [mainUrl, setMainUrl] = useState(null);
  const [title, setTitle] = useState(idea?.title || "");
  const [writeUp, setWriteUp] = useState("");
  const [details, setDetails] = useState({});
  const [imported, setImported] = useState(null); // case study fields read from Word
  const [stage, setStage] = useState(null); // null | "saving" | "writing"
  const [error, setError] = useState(null);

  const busy = stage !== null;
  const hasInput = images.length > 0 || writeUp.trim().length > 20 || Boolean(imported);
  const canSubmit = hasInput && !busy;

  const onImported = (doc) => {
    if (doc.title && !title.trim()) setTitle(doc.title.slice(0, 200));
    if (doc.writeUp) setWriteUp((w) => (w.trim() ? `${w.trim()}\n\n${doc.writeUp}` : doc.writeUp).slice(0, 50000));
    setDetails((d) => ({ ...doc.details, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v)) }));
    if (doc.photos?.length) setImages((imgs) => [...imgs, ...doc.photos].slice(0, 10));
    setImported(doc.caseStudy);
  };

  const submit = async (event) => {
    event.preventDefault();
    const useAi = (event.nativeEvent.submitter?.value || "ai") === "ai";
    setError(null);
    let jobId;
    try {
      setStage("saving");
      const cleanDetails = Object.fromEntries(Object.entries(details).filter(([, v]) => v));
      const { job } = await post("/api/jobs", {
        title,
        writeUp,
        details: cleanDetails,
        images,
        mainImage: images.some((i) => i.url === mainUrl) ? mainUrl : images[0]?.url || null,
        source: imported ? "word" : useAi ? "ai" : "manual",
        ...(idea ? { ideaId: idea.id } : {}),
        ...(imported ? { content: { caseStudy: { ...imported, title: imported.title || title } } } : {}),
      });
      jobId = job.id;
      if (!useAi) {
        toast.success("Job saved. Write or paste each section, then approve it.");
        router.push(`/jobs/${job.id}?manual=1`);
        return;
      }
      setStage("writing");
      await post(`/api/jobs/${job.id}/generate`, imported ? { preserve: ["caseStudy"] } : {});
      toast.success("AI draft ready — check and approve each part before it goes out.");
      router.push(`/jobs/${job.id}`);
    } catch (e) {
      setStage(null);
      if (jobId) {
        toast.error(`Saved the job, but the AI couldn't write it (${e.message}). You can write it yourself or try again.`);
        router.push(`/jobs/${jobId}?manual=1`);
      } else {
        setError(e.message);
      }
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-6">
        {idea && (
          <div className="flex flex-col gap-1 rounded-xl bg-primary-soft p-4 text-sm text-primary">
            <p className="font-semibold">From the content pipeline: {idea.title}</p>
            {idea.keyword && (
              <p>
                Targets <strong>“{idea.keyword}”</strong>
                {idea.volume != null ? ` (${idea.volume} searches/month)` : ""} — the AI writes towards it, and the idea moves to In progress.
              </p>
            )}
            {idea.angle && <p className="text-primary/80">{idea.angle}</p>}
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Already written it up?</CardTitle>
            <CardDescription>
              Import a Word case study (.docx). AI works out which part of your document belongs in each of the website&apos;s case study fields — scope, key works, challenges, outcome, classification, location, SEO — using only facts in the document, and tells you what&apos;s missing. Its photos are added too. Untick “Read with AI” to map by headings instead.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocxImport onImported={onImported} known={{ title, ...details }} disabled={busy} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
            <CardDescription>Finished work, plant, before/after. Mark the main building photo — it&apos;s the case study hero and card image.</CardDescription>
          </CardHeader>
          <CardContent>
            <PhotoUploader images={images} onChange={setImages} mainUrl={mainUrl} onMainChange={setMainUrl} disabled={busy} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What was the job?</CardTitle>
            <CardDescription>
              A few lines in your own words: what you did, what kit, any problem you solved, what the client gets now. The AI only uses facts you give it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Job title</Label>
              <Input id="title" placeholder="e.g. VRF replacement, 3 floors, Canary Wharf office" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} maxLength={200} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="writeUp">Write-up</Label>
              <Textarea
                id="writeUp"
                className="min-h-44"
                placeholder="Replaced 4 end-of-life split systems with a Mitsubishi City Multi VRF system across floors 2-4 while the tenant stayed in. Weekend crane lift for the condensers. Pressure tested, commissioned, F-Gas records and O&Ms handed over…"
                value={writeUp}
                onChange={(e) => setWriteUp(e.target.value)}
                disabled={busy}
                maxLength={10000}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Optional. These use the website&apos;s exact categories.</CardDescription>
          </CardHeader>
          <CardContent>
            <JobDetailsFields value={details} onChange={setDetails} disabled={busy} />
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-6">
          <CardContent className="flex flex-col gap-3">
            <Button type="submit" name="mode" value="ai" size="lg" disabled={!canSubmit} className="w-full">
              {stage === "writing" ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {stage === "saving" ? "Saving job…" : stage === "writing" ? "AI is drafting…" : "Create and draft with AI"}
            </Button>
            <Button type="submit" name="mode" value="manual" variant="outline" size="lg" disabled={!canSubmit} className="w-full">
              <PenLine /> Create without AI
            </Button>
            <p className="text-xs text-gray-500">
              {stage === "writing"
                ? "Reading the photos and drafting LinkedIn, Instagram, the case study, keywords and tips. Usually under a minute."
                : imported
                  ? "Your imported case study is kept as written — AI only fills empty fields (like SEO) and drafts the posts."
                  : "AI drafts the LinkedIn post, Instagram caption, case study, Google Business post, keywords and tips. Or skip AI and write them yourself."}
            </p>
            <p className="text-xs text-gray-500">Nothing goes to Buffer or the website until you approve it.</p>
            {!canSubmit && !busy && <p className="text-xs text-gray-500">Add a photo, a write-up or a Word document to start.</p>}
            {error && <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
