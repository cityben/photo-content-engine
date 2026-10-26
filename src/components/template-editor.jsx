"use client";

import { useState } from "react";
import { FileText, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { applyTemplate, EMPTY_TEMPLATE, fillVariables, hasForced, TEMPLATE_FIELD, TEMPLATE_SECTIONS } from "@/lib/templates";
import { cn } from "@/lib/utils";

export const TEMPLATE_LABEL = { linkedin: "LinkedIn", instagram: "Instagram", googleBusiness: "Google Business", blog: "Blog post", caseStudy: "Case study" };

const VARIABLES = "{{title}}, {{location}} and {{client}} fill in from the job.";

/** The three boxes for one channel, with a live preview of what a post looks like. */
function Fields({ section, value, onChange }) {
  const forced = Boolean(TEMPLATE_FIELD[section]);
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  const sample = applyTemplate(section, { [TEMPLATE_FIELD[section]]: "…the post written for each job goes here…" }, value, { title: "Office VRF replacement", details: { location: "Rochester" } });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`tpl-${section}-guide`}>Guidance for the AI</Label>
        <Textarea id={`tpl-${section}-guide`} className="min-h-20" value={value.guide} onChange={set("guide")} placeholder="e.g. Always mention we're F-Gas and REFCOM certified. End on a question. No emojis." />
        <p className="text-xs text-gray-500">The AI reads this as a reference when it writes. It isn&apos;t copied word for word.</p>
      </div>
      {forced && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`tpl-${section}-top`}>Always add at the top</Label>
            <Textarea id={`tpl-${section}-top`} className="min-h-16" value={value.top} onChange={set("top")} placeholder="Optional — exact words for the start of every post" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`tpl-${section}-bottom`}>Always add at the bottom</Label>
            <Textarea id={`tpl-${section}-bottom`} className="min-h-16" value={value.bottom} onChange={set("bottom")} placeholder="Optional — e.g. a sign-off or how to get a quote" />
            <p className="text-xs text-gray-500">Added word for word to every new {TEMPLATE_LABEL[section]} post, after the AI writes. {VARIABLES}</p>
          </div>
          {hasForced(value) && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-500">Preview</span>
              <p className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm leading-6 text-gray-700">{sample[TEMPLATE_FIELD[section]]}</p>
            </div>
          )}
        </>
      )}
      {!forced && <p className="text-xs text-gray-500">Case studies are structured fields, so they take guidance only.</p>}
    </div>
  );
}

async function save(templates, sections) {
  const body = Object.fromEntries(sections.map((s) => [s, templates[s]]));
  const { templates: saved } = await api("/api/settings/templates", { method: "PUT", body });
  return saved;
}

/** Settings → Templates: every channel in one card. */
export function TemplatesSettings({ initial }) {
  const [templates, setTemplates] = useState(initial);
  const [section, setSection] = useState("linkedin");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Channel">
        {TEMPLATE_SECTIONS.map((s) => {
          const t = templates[s] || EMPTY_TEMPLATE;
          const on = Boolean(t.guide || t.top || t.bottom);
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={section === s}
              onClick={() => setSection(s)}
              className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring", section === s ? "bg-primary-soft text-primary" : "text-gray-600 hover:bg-gray-100")}
            >
              {TEMPLATE_LABEL[s]}
              {on && <span aria-label="has a template" className="size-1.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
      <Fields section={section} value={templates[section] || EMPTY_TEMPLATE} onChange={(v) => setTemplates((t) => ({ ...t, [section]: v }))} />
      <Button
        className="self-start"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setTemplates(await save(templates, [section]));
            toast.success(`${TEMPLATE_LABEL[section]} template saved. It's used for new posts from now on.`);
          } catch (e) {
            toast.error(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Save />} Save {TEMPLATE_LABEL[section]} template
      </Button>
    </div>
  );
}

/**
 * The template line in a job's channel tab: what the template does, add it
 * to this post now, or edit it (saved for every job).
 */
export function TemplateBar({ section, templates, onTemplates, data, job, onApply }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(templates?.[section] || EMPTY_TEMPLATE);
  const [busy, setBusy] = useState(false);
  const t = templates?.[section] || EMPTY_TEMPLATE;
  const field = TEMPLATE_FIELD[section];
  const body = String(data?.[field] || "");
  const missing = field && hasForced(t) && ((t.top && !body.startsWith(fillVariables(t.top, job).trim())) || (t.bottom && !body.trimEnd().endsWith(fillVariables(t.bottom, job).trim())));
  const parts = [t.top && "top text", t.bottom && "bottom text", t.guide && "AI guidance"].filter(Boolean);

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
      <span className="flex items-center gap-1.5">
        <FileText className="size-3.5 text-gray-400" />
        {parts.length ? `Template: ${parts.join(", ")}` : "No template for this channel yet"}
      </span>
      <span className="flex items-center gap-1">
        {missing && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onApply(applyTemplate(section, data || {}, t, job))}>
            Add template text to this post
          </Button>
        )}
        <Dialog
          open={open}
          onOpenChange={(v) => {
            if (v) setDraft(templates?.[section] || EMPTY_TEMPLATE);
            setOpen(v);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
              {parts.length ? "Edit template" : "Add a template"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{TEMPLATE_LABEL[section]} template</DialogTitle>
              <DialogDescription>Used for every job&apos;s {TEMPLATE_LABEL[section]} — when the AI writes it, and when you start one by hand.</DialogDescription>
            </DialogHeader>
            <Fields section={section} value={draft} onChange={setDraft} />
            <DialogFooter>
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    onTemplates(await save({ ...templates, [section]: draft }, [section]));
                    toast.success("Template saved.");
                    setOpen(false);
                  } catch (e) {
                    toast.error(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Save />} Save template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </span>
    </div>
  );
}
