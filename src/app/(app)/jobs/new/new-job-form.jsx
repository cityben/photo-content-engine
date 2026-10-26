"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

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

export function NewJobForm() {
  const router = useRouter();
  const [images, setImages] = useState([]);
  const [title, setTitle] = useState("");
  const [writeUp, setWriteUp] = useState("");
  const [details, setDetails] = useState({});
  const [stage, setStage] = useState(null); // null | "saving" | "writing"
  const [error, setError] = useState(null);

  const busy = stage !== null;
  const canSubmit = (images.length > 0 || writeUp.trim().length > 20) && !busy;

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    let jobId;
    try {
      setStage("saving");
      const cleanDetails = Object.fromEntries(Object.entries(details).filter(([, v]) => v));
      const { job } = await post("/api/jobs", { title, writeUp, details: cleanDetails, images });
      jobId = job.id;
      setStage("writing");
      await post(`/api/jobs/${job.id}/generate`, {});
      toast.success("Content ready — review it before scheduling.");
      router.push(`/jobs/${job.id}`);
    } catch (e) {
      setStage(null);
      if (jobId) {
        toast.error(`Saved the job, but writing failed: ${e.message}`);
        router.push(`/jobs/${jobId}`);
      } else {
        setError(e.message);
      }
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
            <CardDescription>Finished work, plant, before/after. The first photo is the cover for the case study and posts.</CardDescription>
          </CardHeader>
          <CardContent>
            <PhotoUploader images={images} onChange={setImages} disabled={busy} />
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
            <Button type="submit" size="lg" disabled={!canSubmit} className="w-full">
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {stage === "saving" ? "Saving job…" : stage === "writing" ? "Writing content…" : "Create and write content"}
            </Button>
            <p className="text-xs text-gray-500">
              {stage === "writing"
                ? "Reading the photos and writing LinkedIn, Instagram, the case study, keywords and tips. Usually under a minute."
                : "Writes a LinkedIn post, Instagram caption, website case study, Google Business post, SEO keywords and recommendations. You review everything before it goes anywhere."}
            </p>
            {!canSubmit && !busy && <p className="text-xs text-gray-500">Add a photo or a write-up to start.</p>}
            {error && <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
