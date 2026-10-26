"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Globe, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import options from "@/data/website-options.json";
import { DocxImport } from "@/components/docx-import";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const ALL_SERVICES = options.serviceGroups.flatMap((g) => g.services.map((s) => ({ value: s, group: g.division })));

function Field({ id, label, hint, max, value, onChange, multiline, rows }) {
  const length = value?.length || 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {max && <span className={cn("text-xs tabular-nums text-gray-500", length > max && "font-medium text-destructive")}>{length}/{max}</span>}
      </div>
      {multiline ? (
        <Textarea id={id} value={value || ""} onChange={(e) => onChange(e.target.value)} className={rows === "lg" ? "min-h-36" : "min-h-24"} />
      ) : (
        <Input id={id} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function Pick({ id, label, value, items, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i} value={i}>
              {i}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg bg-gray-50 p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function CaseStudyForm({ job, data, onChange, websiteConnected, dirty, onSave, approved }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const cs = data || {};
  const set = (key) => (value) => onChange({ ...cs, [key]: value });
  const services = cs.services || [];
  const sent = job.website?.projectId;

  const fillFromWord = ({ caseStudy }) => {
    // Document values win where the document has them; everything else stays.
    const filled = Object.fromEntries(
      Object.entries(caseStudy).filter(([, v]) => (Array.isArray(v) ? v.length : v !== "" && v != null))
    );
    onChange({ ...cs, ...filled });
  };

  const send = async () => {
    setSending(true);
    try {
      const { website } = await api(`/api/jobs/${job.id}/website`, { method: "POST" });
      toast.success("Case study saved to the website as a draft.");
      router.refresh();
      return website;
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
            <p className="text-sm font-semibold text-gray-900">
              {sent ? "On the website as a draft" : "Website case study"}
            </p>
            <p className="text-xs text-gray-700">
              {sent
                ? "Review and publish it in the website admin. Edits here won't sync after sending."
                : !approved || dirty
                  ? "Approve the case study (above) first. Then photos upload to the website and it's created unpublished for a final check."
                  : websiteConnected
                  ? "Approved. Photos upload to the website, then the case study is created unpublished for a final check in the website admin."
                  : "Connect the website (WEBSITE_API_KEY in Settings) to send this straight in. You can copy fields meanwhile."}
            </p>
          </div>
        </div>
        {sent ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={job.website.url} target="_blank" rel="noreferrer">
                Preview <ExternalLink />
              </a>
            </Button>
            <Badge variant="success">Draft</Badge>
          </div>
        ) : (
          <Button onClick={send} disabled={!websiteConnected || sending || !approved || dirty || !cs.title || !cs.description}>
            {sending ? <Loader2 className="animate-spin" /> : <Globe />}
            {sending ? "Sending…" : "Send as draft"}
          </Button>
        )}
      </div>

      {!sent && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 p-4">
          <p className="text-sm text-gray-700">Have it in Word? Fill these fields from the document — no AI, nothing overwritten that the document doesn&apos;t have.</p>
          <DocxImport onImported={fillFromWord} known={job.details || {}} withPhotos={false} label="Fill from Word" />
        </div>
      )}

      <Section title="Basics" description="Shown on the case study page and its listing card.">
        <Field id="cs-title" label="Title" max={70} value={cs.title} onChange={set("title")} />
        <Field id="cs-description" label="Summary (lede)" max={300} value={cs.description} onChange={set("description")} multiline hint="Opening paragraph; also the meta description if that's empty." />
        <div className="grid gap-4 sm:grid-cols-3">
          <Pick id="cs-company" label="Division" value={cs.company} items={options.companies} onChange={set("company")} />
          <Pick id="cs-sector" label="Sector" value={cs.sector} items={options.sectors} onChange={set("sector")} />
          <Pick id="cs-type" label="Project type" value={cs.projectType} items={options.projectTypes} onChange={set("projectType")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cs-services">Services delivered</Label>
          <div className="flex flex-wrap gap-1.5">
            {services.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-800 shadow-paper">
                {s}
                <button type="button" onClick={() => set("services")(services.filter((x) => x !== s))} aria-label={`Remove ${s}`} className="rounded-full text-gray-500 hover:text-gray-900">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <Select value="" onValueChange={(v) => v && !services.includes(v) && set("services")([...services, v])}>
            <SelectTrigger id="cs-services">
              <SelectValue placeholder="Add a service…" />
            </SelectTrigger>
            <SelectContent>
              {ALL_SERVICES.filter((s) => !services.includes(s.value)).map((s) => (
                <SelectItem key={`${s.group}-${s.value}`} value={s.value}>
                  {s.value} <span className="text-gray-500">· {s.group}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">These link the case study to the matching service pages.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="cs-client" label="Client" value={cs.client} onChange={set("client")} />
          <Field id="cs-area" label="Area" value={cs.area} onChange={set("area")} />
          <Field id="cs-county" label="County" value={cs.county} onChange={set("county")} />
        </div>
      </Section>

      <Section title="The story" description="Each becomes a tab on the case study page. Markdown works. Leave one empty to hide it.">
        <Field id="cs-scope" label="Scope of works" value={cs.scopeOfWorks} onChange={set("scopeOfWorks")} multiline rows="lg" />
        <Field id="cs-key" label="Key works delivered" value={cs.keyWorks} onChange={set("keyWorks")} multiline rows="lg" />
        <Field id="cs-challenges" label="Key challenges & solutions" value={cs.keyChallenges} onChange={set("keyChallenges")} multiline rows="lg" />
        <Field id="cs-highlights" label="Delivery highlights" value={cs.deliveryHighlights} onChange={set("deliveryHighlights")} multiline rows="lg" />
        <Field id="cs-outcome" label="Outcome & results" value={cs.projectOutcome} onChange={set("projectOutcome")} multiline rows="lg" />
      </Section>

      <Section title="Search (SEO)" description="The website doesn't auto-fill these for API-created case studies, so they're written here.">
        <Field id="cs-seotitle" label="SEO title" max={60} value={cs.seoTitle} onChange={set("seoTitle")} hint="Shown as the Google result headline." />
        <Field id="cs-meta" label="Meta description" max={155} value={cs.metaDescription} onChange={set("metaDescription")} multiline hint="The snippet under the headline in Google." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cs-h1" label="Page H1" value={cs.seoH1} onChange={set("seoH1")} />
          <Field id="cs-primary" label="Primary keyword" value={cs.primaryKeyword} onChange={set("primaryKeyword")} />
        </div>
        <Field id="cs-supporting" label="Supporting keywords" value={cs.supportingKeywords} onChange={set("supportingKeywords")} hint="Comma-separated." />
        <Field id="cs-alt" label="Hero photo alt text" value={cs.mainImageAlt} onChange={set("mainImageAlt")} />
      </Section>
    </div>
  );
}
