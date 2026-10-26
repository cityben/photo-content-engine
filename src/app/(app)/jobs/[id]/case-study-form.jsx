"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Globe, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { DocxImport } from "@/components/docx-import";
import { useWebsiteOptions } from "@/components/options-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CASE_STUDY_SPEC, completeness, normaliseCaseStudy, serviceLinksFor, TEMPLATES } from "@/lib/case-study-fields";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";


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

/** Several values from a fixed list, as removable chips (the website stores lists). */
function MultiPick({ id, label, values, items, onChange, hint, group }) {
  const list = values || [];
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {list.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-800 shadow-paper">
              {s}
              <button type="button" onClick={() => onChange(list.filter((x) => x !== s))} aria-label={`Remove ${s}`} className="rounded-full text-gray-500 hover:text-gray-900">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Select value="" onValueChange={(v) => v && !list.includes(v) && onChange([...list, v])}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={list.length ? "Add another…" : "Choose…"} />
        </SelectTrigger>
        <SelectContent>
          {items
            .filter((i) => !list.includes(i.value ?? i))
            .map((i) => (
              <SelectItem key={`${i.group || ""}-${i.value ?? i}`} value={i.value ?? i}>
                {i.value ?? i} {group && i.group && <span className="text-gray-500">· {i.group}</span>}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function Completeness({ cs }) {
  const c = completeness(cs);
  const missing = [...c.required, ...c.recommended];
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900">Website case study: {c.percent}% complete</p>
        <span className="h-2 w-40 overflow-hidden rounded-full bg-white">
          <span className={cn("block h-full rounded-full", c.required.length ? "bg-destructive" : "bg-marker")} style={{ width: `${c.percent}%` }} />
        </span>
      </div>
      {c.required.length > 0 && <p className="text-xs text-destructive">Needed to send: {c.required.map((m) => m.label).join(", ")}.</p>}
      {c.recommended.length > 0 && (
        <p className="text-xs text-gray-600">
          Would make it stronger: {missing.filter((m) => !c.required.includes(m)).map((m) => (m.why ? `${m.label} (${m.why})` : m.label)).join(", ")}.
        </p>
      )}
      {c.tooLong.length > 0 && <p className="text-xs text-destructive">Too long: {c.tooLong.map((m) => `${m.label} (max ${m.max})`).join(", ")}.</p>}
      {!missing.length && !c.tooLong.length && <p className="text-xs text-gray-600">Everything the website uses is filled in.</p>}
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
  const options = useWebsiteOptions();
  const ALL_SERVICES = options.serviceGroups.flatMap((g) => g.services.map((s) => ({ value: s, group: g.division })));
  const cs = normaliseCaseStudy(data || {});
  const set = (key) => (value) => onChange({ ...cs, [key]: value });
  const full = cs.template === "full";
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
          <p className="text-sm text-gray-700">Have it in Word? AI reads the document into these fields (or untick it to map by headings). Only fields the document has are replaced.</p>
          <DocxImport onImported={fillFromWord} known={job.details || {}} withPhotos={false} label="Fill from Word" />
        </div>
      )}

      <Completeness cs={cs} />

      <Section title="Overview" description="Mirrors the website editor's Overview tab.">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cs-template">{CASE_STUDY_SPEC.template.label}</Label>
          <Select value={cs.template} onValueChange={set("template")}>
            <SelectTrigger id="cs-template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">{TEMPLATES.find((t) => t.value === cs.template)?.hint}</p>
        </div>
        <Field id="cs-title" label="Job name" max={70} value={cs.title} onChange={set("title")} hint="e.g. Rochester Office CAT-B Fit-out" />
        <MultiPick id="cs-company" label="Company" values={cs.company} items={options.companies} onChange={set("company")} hint="Every company that delivered this job." />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="cs-area" label="Area" value={cs.area} onChange={set("area")} hint="e.g. Rochester" />
          <Field id="cs-county" label="Borough / county" value={cs.county} onChange={set("county")} hint="e.g. Kent" />
          <Field id="cs-postcode" label="Postcode" value={cs.postcode} onChange={set("postcode")} hint="Places the map pin." />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cs-weeks">Project duration (weeks)</Label>
            <Input id="cs-weeks" type="number" min={0} step={1} value={cs.durationWeeks ?? ""} onChange={(e) => set("durationWeeks")(e.target.value === "" ? null : Number(e.target.value))} />
          </div>
          <Field id="cs-client" label="Client" value={cs.client} onChange={set("client")} hint="Leave blank if confidential." />
          <label className="mt-7 flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={Boolean(cs.addToMap)} onChange={(e) => set("addToMap")(e.target.checked)} className="size-4 accent-[#003157]" />
            Show on the site map
          </label>
        </div>
      </Section>

      <Section title="Classification" description="Services delivered decide which service pages show this case study.">
        <div className="grid gap-4 sm:grid-cols-2">
          <MultiPick id="cs-type" label="Type of project" values={cs.projectType} items={options.projectTypes} onChange={set("projectType")} />
          <MultiPick id="cs-sector" label="Project sector" values={cs.sector} items={options.sectors} onChange={set("sector")} />
        </div>
        <MultiPick id="cs-services" label="Services delivered" values={cs.services} items={ALL_SERVICES} group onChange={set("services")} hint="Ticking a service puts this case study on that service's page." />
      </Section>

      <Section title="Summary" description="Shown on cards and in Google results.">
        <Field id="cs-description" label="Short summary" max={300} value={cs.description} onChange={set("description")} multiline hint="One or two sentences summarising the job." />
      </Section>

      <Section title="Case study" description={`Markdown works. The ${full ? "Full" : "Simple"} type shows ${full ? "scope, challenges, highlights and outcome" : "scope, key works and outcome"}.`}>
        <Field id="cs-scope" label="Scope of works" value={cs.scopeOfWorks} onChange={set("scopeOfWorks")} multiline rows="lg" />
        {!full && <Field id="cs-key" label="Key works delivered" value={cs.keyWorks} onChange={set("keyWorks")} multiline rows="lg" />}
        {full && <Field id="cs-challenges" label="Key challenges & solutions" value={cs.keyChallenges} onChange={set("keyChallenges")} multiline rows="lg" />}
        {full && <Field id="cs-highlights" label="Project delivery highlights" value={cs.deliveryHighlights} onChange={set("deliveryHighlights")} multiline rows="lg" />}
        <Field id="cs-outcome" label="Project outcome & results" value={cs.projectOutcome} onChange={set("projectOutcome")} multiline rows="lg" />
      </Section>

      <Section title="Client testimonial" description="Only a real quote from the client. Saved testimonials also appear in the website's Reviews.">
        <label className="flex items-center gap-2 text-sm text-gray-800">
          <input type="checkbox" checked={Boolean(cs.testimonialEnabled)} onChange={(e) => set("testimonialEnabled")(e.target.checked)} className="size-4 accent-[#003157]" />
          We received a testimonial for this job
        </label>
        {cs.testimonialEnabled && (
          <>
            <Field id="cs-quote" label="Testimonial" value={cs.testimonialQuote} onChange={set("testimonialQuote")} multiline />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="cs-quote-author" label="Client name" value={cs.testimonialAuthor} onChange={set("testimonialAuthor")} />
              <Field id="cs-quote-role" label="Client role / company" value={cs.testimonialRole} onChange={set("testimonialRole")} hint="e.g. Facilities Manager, Acme Ltd" />
            </div>
          </>
        )}
      </Section>

      <Section title="SEO" description="Filled here so the website doesn't have to guess.">
        <Field id="cs-seotitle" label="Title tag" max={60} value={cs.seoTitle} onChange={set("seoTitle")} hint="Browser tab and Google headline." />
        <Field id="cs-meta" label="Meta description" max={155} value={cs.metaDescription} onChange={set("metaDescription")} multiline hint="The grey text Google shows." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cs-h1" label="Recommended H1" value={cs.seoH1} onChange={set("seoH1")} />
          <Field id="cs-primary" label="Primary keyword" value={cs.primaryKeyword} onChange={set("primaryKeyword")} />
        </div>
        <Field id="cs-supporting" label="Supporting keywords" value={cs.supportingKeywords} onChange={set("supportingKeywords")} hint="Separate with semicolons." />
        <Field id="cs-alt" label="Main image alt text" value={cs.mainImageAlt} onChange={set("mainImageAlt")} />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="cs-links">Suggested service links</Label>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => set("seoServiceLinks")(serviceLinksFor(cs.services, options.servicePages))} disabled={!cs.services?.length}>
              From services delivered
            </Button>
          </div>
          <Textarea id="cs-links" value={cs.seoServiceLinks || ""} onChange={(e) => set("seoServiceLinks")(e.target.value)} className="min-h-24 font-mono text-xs" />
          <p className="text-xs text-gray-500">One per line, “Label | /url”.</p>
        </div>
        <Field id="cs-notes" label="Internal publishing notes" value={cs.seoNotes} onChange={set("seoNotes")} multiline hint="Kept on file — never shown on the website." />
      </Section>
    </div>
  );
}
