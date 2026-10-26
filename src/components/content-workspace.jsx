"use client";

import { useRef, useState } from "react";
import { AlertCircle, Check, Copy, Download, FileJson, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { BufferPreview } from "@/components/buffer-preview";
import { ContentCard } from "@/components/content-card";
import { JobDetails } from "@/components/job-details";
import { PhotoDropzone } from "@/components/photo-dropzone";
import { useCopy } from "@/components/use-copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { exportMarkdown, FORMATS } from "@/lib/formats";
import { cn } from "@/lib/utils";

const EMPTY_DETAILS = { job_title: "", sector: "", location: "" };

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugify(text) {
  return (text || "job-photo-content")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function ChipGroup({ label, items }) {
  if (!Array.isArray(items) || !items.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="secondary">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function Fact({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-700">{value}</dd>
    </div>
  );
}

function Insights({ analysis, keywords, loading }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">What the photo shows</CardTitle>
        <CardDescription>The details every format below is written from.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2" aria-hidden>
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3.5 w-5/6" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-5">
              {analysis?.raw ? (
                <p className="whitespace-pre-wrap text-sm text-gray-700">{analysis.raw}</p>
              ) : (
                <>
                  <ChipGroup label="Equipment" items={analysis?.equipment} />
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Fact label="Work type" value={analysis?.work_type} />
                    <Fact label="Sector" value={analysis?.sector} />
                    <Fact label="Scope" value={analysis?.scope} />
                    <Fact label="Quality" value={analysis?.quality_assessment} />
                  </dl>
                </>
              )}
            </div>
            <div className="flex flex-col gap-5 rounded-lg bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800">SEO keywords</p>
                {keywords?.difficulty && (
                  <Badge variant="default">Difficulty: {keywords.difficulty}</Badge>
                )}
              </div>
              {keywords?.error ? (
                <p className="text-sm text-destructive">Keywords failed: {keywords.error}</p>
              ) : (
                <>
                  <ChipGroup label="Primary" items={keywords?.primary_keywords} />
                  <ChipGroup label="Long-tail" items={keywords?.secondary_keywords} />
                  <ChipGroup label="Local" items={keywords?.location_keywords} />
                  {keywords?.recommended_focus && (
                    <p className="text-sm text-gray-600">{keywords.recommended_focus}</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ContentWorkspace() {
  const [photo, setPhoto] = useState(null);
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const { copied, copy } = useCopy();

  const generate = async () => {
    if (!photo) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const metadata = Object.fromEntries(
        Object.entries(details).filter(([, v]) => v?.trim())
      );
      const res = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: photo.dataUrl, metadata }),
        signal: controller.signal,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.details || body.error || `Server returned ${res.status}`);
      }
      setResult({ ...body, metadata });
      toast.success("Content ready — review each format before posting.");
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  const markdown = result ? exportMarkdown(result, result.metadata) : "";
  const filename = slugify(result?.metadata?.job_title);
  const hasOutput = loading || result;

  return (
    <div className="flex flex-col gap-8">
      {/* Upload + details */}
      <section aria-labelledby="upload-heading" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle id="upload-heading" className="text-lg">
              Job photo
            </CardTitle>
            <CardDescription>
              One clear photo of the finished work. It&apos;s resized in your browser before upload.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <PhotoDropzone photo={photo} onChange={setPhoto} disabled={loading} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Job details</CardTitle>
            <CardDescription>Helps the copy name the right sector and area.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-6">
            <JobDetails value={details} onChange={setDetails} disabled={loading} />
            <Separator />
            <div className="mt-auto flex flex-col gap-3">
              <Button size="lg" onClick={generate} disabled={!photo || loading} className="w-full">
                {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {loading ? "Writing content…" : "Generate 7 formats"}
              </Button>
              {loading ? (
                <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                  <span>Reading the photo, then writing each format. This can take up to a minute.</span>
                  <Button variant="ghost" size="sm" onClick={cancel}>
                    Cancel
                  </Button>
                </div>
              ) : !photo ? (
                <p className="text-xs text-gray-500">Add a photo to start.</p>
              ) : null}
              {error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2.5 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Generation failed: {error}. Check the photo and try again.
                  </span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {hasOutput && (
        <Insights
          analysis={result?.image_analysis}
          keywords={result?.content?.keywords}
          loading={loading}
        />
      )}

      {/* Formats */}
      <section aria-labelledby="formats-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="formats-heading" className="text-lg font-semibold text-gray-900">
              Content formats
            </h2>
            <p className="text-sm text-gray-600">
              Seven ready-to-edit pieces from one photo. Copy one, or export them all.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!result}
              onClick={() => copy(markdown, "All formats copied as Markdown")}
            >
              {copied ? <Check /> : <Copy />} Copy all
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!result}
              onClick={() => download(`${filename}.md`, markdown, "text/markdown")}
            >
              <Download /> Markdown
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!result}
              onClick={() =>
                download(
                  `${filename}.json`,
                  JSON.stringify(
                    { image_analysis: result.image_analysis, content: result.content, metadata: result.metadata },
                    null,
                    2
                  ),
                  "application/json"
                )
              }
            >
              <FileJson /> JSON
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {FORMATS.map((format) => (
            <ContentCard
              key={format.key}
              format={format}
              data={result?.content?.[format.key]}
              loading={loading}
              className={cn(format.key === "schema" && "md:col-span-2")}
            />
          ))}
        </div>
      </section>

      {result && (
        <section aria-label="Buffer preview">
          <BufferPreview key={result.timestamp} content={result.content} photo={photo} />
        </section>
      )}
    </div>
  );
}
