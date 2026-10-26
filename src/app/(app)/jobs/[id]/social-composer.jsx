"use client";

import Image from "next/image";
import { Check, Copy } from "lucide-react";

import { PostRow } from "@/components/post-row";
import { useCopy } from "@/components/use-copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { orderedImages } from "@/lib/content";
import { serviceInfo } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

import { ScheduleBox } from "./schedule-box";

function combine(text, hashtags = []) {
  const missing = hashtags.filter((t) => t && !text.includes(t));
  return missing.length ? `${text.trim()}\n\n${missing.join(" ")}` : text.trim();
}

function Preview({ service, text, images }) {
  const instagram = service === "instagram";
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <div className="mx-auto flex max-w-sm flex-col gap-3 rounded-lg bg-white p-4 shadow-paper">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">CC</span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-gray-900">{instagram ? "acme" : "Acme Ltd"}</span>
            <span className="text-xs text-gray-500">{serviceInfo(service).label} preview</span>
          </div>
        </div>
        {!instagram && <p className="line-clamp-[12] text-sm leading-6 whitespace-pre-wrap break-words text-gray-700">{text || "—"}</p>}
        {images[0] && (
          <div className={cn("relative overflow-hidden rounded-md bg-gray-100", instagram ? "aspect-square" : "aspect-[16/10]")}>
            <Image src={images[0]} alt="" fill unoptimized sizes="384px" className="object-cover" />
            {images.length > 1 && (
              <span className="absolute top-2 right-2 rounded-full bg-gray-900/70 px-2 py-0.5 text-xs text-white">1/{images.length}</span>
            )}
          </div>
        )}
        {instagram && <p className="line-clamp-[8] text-sm leading-6 whitespace-pre-wrap break-words text-gray-700">{text || "—"}</p>}
      </div>
    </div>
  );
}

/**
 * Edit + preview + schedule for one social network.
 * `data`: linkedin {text, hashtags, firstComment} | instagram {caption, hashtags, firstComment, altText}
 */
export function SocialComposer({ service, data, onChange, job, social, posts, selectedImages, onSelectImages, approved, dirty }) {
  const { copied, copy } = useCopy();
  const info = serviceInfo(service);
  const bodyKey = service === "instagram" ? "caption" : "text";
  const body = data?.[bodyKey] || "";
  const hashtags = data?.hashtags || [];
  const full = combine(body, hashtags);
  const over = full.length > info.limit;
  const images = orderedImages(job).filter((img) => selectedImages.includes(img.url));

  const set = (key, value) => onChange({ ...data, [key]: value });

  const problem = dirty
    ? "Save and approve your changes before scheduling."
    : !approved
      ? `Approve this ${service === "instagram" ? "caption" : "post"} first — nothing goes out unapproved.`
      : over
    ? `Too long for ${info.label} (${full.length}/${info.limit}).`
    : service === "instagram" && !images.length
      ? "Instagram needs at least one photo selected."
      : social.mode === "live" && images.some((i) => !i.public)
        ? "These photos aren't publicly hosted yet — connect Vercel Blob and re-upload them."
        : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${service}-body`}>{service === "instagram" ? "Caption" : "Post"}</Label>
            <span className={cn("text-xs tabular-nums text-gray-500", over && "font-medium text-destructive")}>
              {full.length.toLocaleString()} / {info.limit.toLocaleString()} with hashtags
            </span>
          </div>
          <Textarea id={`${service}-body`} className="min-h-64" value={body} onChange={(e) => set(bodyKey, e.target.value)} />
          {service === "linkedin" && (
            <p className="text-xs text-gray-500">LinkedIn cuts posts at about 210 characters behind &quot;see more&quot; — the first line has to earn the click.</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${service}-tags`}>Hashtags</Label>
          <Input
            id={`${service}-tags`}
            value={hashtags.join(" ")}
            onChange={(e) => set("hashtags", e.target.value.split(/\s+/).filter(Boolean))}
          />
          <p className="text-xs text-gray-500">
            {service === "linkedin" ? "3–5 specific tags works best on LinkedIn." : "Instagram allows up to 30; 10–20 relevant ones is plenty."}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${service}-comment`}>First comment (optional)</Label>
          <Textarea id={`${service}-comment`} className="min-h-20" value={data?.firstComment || ""} onChange={(e) => set("firstComment", e.target.value)} />
          <p className="text-xs text-gray-500">
            Links in the post body reduce reach on both networks — put them here. <code className="rounded bg-gray-100 px-1">{"{{case_study_url}}"}</code> becomes the case study link once it&apos;s on the website.
          </p>
        </div>

        {service === "instagram" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="ig-alt">Alt text</Label>
            <Input id="ig-alt" value={data?.altText || ""} onChange={(e) => set("altText", e.target.value)} />
          </div>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-gray-700">
            Photos to attach {service === "instagram" && images.length > 1 && <span className="font-normal text-gray-500">— posts as a carousel</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {orderedImages(job).map((img, i) => {
              const on = selectedImages.includes(img.url);
              return (
                <button
                  key={img.url}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Photo ${i + 1}`}
                  onClick={() => onSelectImages(on ? selectedImages.filter((u) => u !== img.url) : [...selectedImages, img.url])}
                  className={cn(
                    "relative size-16 overflow-hidden rounded-md bg-gray-100 outline-none transition-[opacity,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring",
                    on ? "ring-[3px] ring-primary" : "opacity-50 hover:opacity-80"
                  )}
                >
                  <Image src={img.url} alt="" fill unoptimized sizes="64px" className="object-cover" />
                  {on && (
                    <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-white">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              );
            })}
            {!job.images?.length && <p className="text-xs text-gray-500">No photos on this job.</p>}
          </div>
        </fieldset>

        {posts.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-700">Scheduled from this job</p>
            {posts.map((p) => (
              <PostRow key={p.id} post={p} showJob={false} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Preview service={service} text={full} images={images.map((i) => i.url)} />
        <Button variant="outline" onClick={() => copy(full, `${info.label} post copied`)} disabled={!body}>
          {copied ? <Check /> : <Copy />} Copy post
        </Button>
        <ScheduleBox
          job={job}
          service={service}
          text={full}
          imageUrls={images.map((i) => i.url)}
          social={social}
          problem={problem}
        />
      </div>
    </div>
  );
}
