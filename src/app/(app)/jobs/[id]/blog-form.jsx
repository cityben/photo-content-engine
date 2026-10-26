"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ExternalLink, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useWebsiteOptions } from "@/components/options-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { mainImageOf } from "@/lib/content";

const words = (text) => (text?.trim() ? text.trim().split(/\s+/).length : 0);

/** The website's News post: title, summary, category, markdown body and a header photo. */
export function BlogForm({ job, data, onChange, websiteConnected, dirty, approved, onShowPhotos }) {
  const router = useRouter();
  const options = useWebsiteOptions();
  const [sending, setSending] = useState(false);
  const blog = data || {};
  const set = (key) => (e) => onChange({ ...blog, [key]: e.target.value });
  const photo = mainImageOf(job);
  const sent = job.blogPost?.id;
  const count = words(blog.content);
  const categories = [...new Set((options.serviceGroups || []).map((g) => g.division).filter(Boolean))];
  const needed = [!blog.title?.trim() && "title", !blog.excerpt?.trim() && "summary", !blog.category?.trim() && "category", !blog.content?.trim() && "article", !photo && "header photo"].filter(Boolean);

  const send = async () => {
    setSending(true);
    try {
      await api(`/api/jobs/${job.id}/blog`, { method: "POST" });
      toast.success("Blog post saved to the website as a draft.");
      router.refresh();
    } catch (e) {
      toast.error(`Couldn't send: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary-soft p-4">
        <div className="flex items-start gap-3">
          <Globe className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-gray-900">{sent ? "On the website as a draft" : "Website blog post"}</p>
            <p className="text-xs text-gray-700">
              {sent
                ? "Review and publish it in the website admin (News posts). Edits here won't sync after sending."
                : !approved || dirty
                  ? "Approve the blog post (above) first. It's then created unpublished for a final check."
                  : websiteConnected
                    ? "Approved. The header photo uploads, then the post is created unpublished for a final check in the website admin."
                    : "Connect the website in Settings to send this straight in."}
            </p>
            {!sent && needed.length > 0 && <p className="text-xs text-destructive">Needed to send: {needed.join(", ")}.</p>}
          </div>
        </div>
        {sent ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={job.blogPost.adminUrl} target="_blank" rel="noreferrer">
                Open in admin <ExternalLink />
              </a>
            </Button>
            <Badge variant="success">Draft</Badge>
          </div>
        ) : (
          <Button onClick={send} disabled={!websiteConnected || sending || !approved || dirty || needed.length > 0}>
            {sending ? <Loader2 className="animate-spin" /> : <Globe />}
            {sending ? "Sending…" : "Send as draft"}
          </Button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="blog-title">Title</Label>
              <span className="text-xs tabular-nums text-gray-500">{blog.title?.length || 0}/70</span>
            </div>
            <Input id="blog-title" value={blog.title || ""} onChange={set("title")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="blog-excerpt">Summary</Label>
              <span className="text-xs tabular-nums text-gray-500">{blog.excerpt?.length || 0}/220</span>
            </div>
            <Textarea id="blog-excerpt" className="min-h-20" value={blog.excerpt || ""} onChange={set("excerpt")} />
            <p className="text-xs text-gray-500">Shown on the News cards and in Google results.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="blog-category">Category</Label>
              <Input id="blog-category" list="blog-categories" value={blog.category || ""} onChange={set("category")} placeholder="e.g. Company news" />
              <datalist id="blog-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="blog-keyword">Target search</Label>
              <Input id="blog-keyword" value={blog.primaryKeyword || ""} onChange={set("primaryKeyword")} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="blog-content">Article (markdown)</Label>
              <span className="text-xs tabular-nums text-gray-500">
                {count.toLocaleString("en-GB")} words · {Math.max(1, Math.round(count / 200))} min read
              </span>
            </div>
            <Textarea id="blog-content" className="min-h-96 font-mono text-[13px] leading-relaxed" value={blog.content || ""} onChange={set("content")} />
            <p className="text-xs text-gray-500">Use ## for section headings. The title is the page heading, so don&apos;t repeat it. The website writes the SEO title and description itself.</p>
          </div>
        </div>
        <aside className="flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-900">Header photo</p>
          {photo ? (
            <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-gray-100">
              <Image src={photo.url} alt={blog.imageAlt || photo.alt || ""} fill unoptimized sizes="16rem" className="object-cover" />
            </div>
          ) : (
            <p className="rounded-lg bg-gray-50 p-4 text-xs text-gray-600">The website needs one. Add a photo — your own, or one from a past job.</p>
          )}
          {photo && job.photoFrom && job.images?.[0]?.url === photo.url && (
            <p className="text-xs text-gray-600">
              Borrowed from{" "}
              <a href={`/jobs/${job.photoFrom.jobId}`} className="text-primary underline underline-offset-4">
                {job.photoFrom.jobTitle}
              </a>
              . Check it suits the article.
            </p>
          )}
          <Button variant="outline" size="sm" className="self-start" onClick={onShowPhotos}>
            {photo ? "Change photo" : "Add a photo"}
          </Button>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="blog-alt">Photo alt text</Label>
            <Textarea id="blog-alt" className="min-h-16" value={blog.imageAlt || ""} onChange={set("imageAlt")} />
          </div>
        </aside>
      </div>
    </div>
  );
}
