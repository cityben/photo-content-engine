"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Info, Loader2, Sparkles } from "lucide-react";

import { uploadPhoto } from "@/components/photo-uploader";
import { Button } from "@/components/ui/button";
import { CASE_STUDY_SPEC } from "@/lib/case-study-fields";
import { api } from "@/lib/client-api";
import { mapCaseStudy } from "@/lib/docx-map";
import { money } from "@/lib/ui-labels";
import { readDocx } from "@/lib/docx-read";

const FIELD_LABELS = {
  title: "Title",
  scopeOfWorks: "Scope of works",
  keyWorks: "Key works",
  keyChallenges: "Challenges",
  deliveryHighlights: "Delivery highlights",
  projectOutcome: "Outcome",
  client: "Client",
  location: "Location",
  sector: "Sector",
  company: "Division",
  projectType: "Project type",
  completedOn: "Completion date",
};

const label = (k) => CASE_STUDY_SPEC[k]?.label || FIELD_LABELS[k] || k;

/** Headings marked so the AI can see the document's structure. */
function documentText(blocks) {
  return blocks
    .filter((b) => b.text?.trim())
    .map((b) => (b.type === "heading" ? `\n## ${b.text.trim()}` : b.type === "li" ? `- ${b.text.trim()}` : b.text.trim()))
    .join("\n")
    .trim();
}

/**
 * Import a Word case study. Read in the browser; then either the AI works
 * out which part of the document belongs in which website field (default),
 * or — with AI off — sections are mapped by their headings. `onImported({ title, writeUp, details, caseStudy, photos })`.
 * `withPhotos`: also upload photos embedded in the document.
 * `known`: values already entered (title, sector, client…) — they win over
 * the document, which only fills what's missing.
 */
export function DocxImport({ onImported, known = {}, withPhotos = true, maxPhotos = 10, disabled, variant = "outline", label = "Import Word case study" }) {
  const inputRef = useRef(null);
  const [state, setState] = useState(null); // { stage, message, summary, error }
  const [useAi, setUseAi] = useState(true);

  const handle = async (file) => {
    if (!file) return;
    setState({ stage: "reading", message: "Reading the document…" });
    try {
      const { blocks, photos, skippedImages } = await readDocx(file);
      if (!blocks.length) throw new Error("No text found in that document.");
      const mapped = mapCaseStudy(blocks, known);

      let ai = null;
      let aiError = null;
      if (useAi) {
        setState({ stage: "reading", message: "AI is reading the document into the website's case study fields… (20–40s)" });
        try {
          ai = await api("/api/case-study/extract", { method: "POST", body: { text: documentText(blocks), known } });
        } catch (e) {
          aiError = e.message;
        }
      }
      if (ai) {
        const cs = ai.caseStudy;
        mapped.caseStudy = { ...cs, writeUp: mapped.caseStudy.writeUp };
        mapped.title = cs.title || mapped.title;
        mapped.details = {
          ...mapped.details,
          ...(cs.company?.[0] && { company: cs.company[0] }),
          ...(cs.sector?.[0] && { sector: cs.sector[0] }),
          ...(cs.projectType?.[0] && { projectType: cs.projectType[0] }),
          ...(cs.services?.length && { services: cs.services }),
          ...(cs.client && { client: cs.client }),
          ...((cs.area || cs.county) && { location: [cs.area, cs.county].filter(Boolean).join(", ") }),
        };
      }

      const uploaded = [];
      if (withPhotos && photos.length) {
        const batch = photos.slice(0, maxPhotos);
        for (const [i, photo] of batch.entries()) {
          setState({ stage: "photos", message: `Uploading photo ${i + 1} of ${batch.length} from the document…` });
          try {
            uploaded.push(await uploadPhoto(photo));
          } catch {
            // One bad image shouldn't stop the import.
          }
        }
      }

      onImported({ ...mapped, photos: uploaded });
      setState({
        stage: "done",
        summary: {
          ai: ai && { model: ai.run?.model, cost: ai.run?.costUsd, fromDocument: ai.fromDocument, written: ai.written, notInDocument: ai.notInDocument, checks: ai.checks, completeness: ai.completeness },
          aiError,
          file: file.name,
          found: mapped.found.map((k) => FIELD_LABELS[k] || k),
          photos: uploaded.length,
          skippedImages: skippedImages + Math.max(0, photos.length - uploaded.length),
          unmatchedHeadings: mapped.unmatchedHeadings,
          unmatchedValues: mapped.unmatchedValues,
          overridden: mapped.overridden,
        },
      });
    } catch (e) {
      setState({ stage: "error", error: e.message });
    }
  };

  const busy = state?.stage === "reading" || state?.stage === "photos";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant={variant} onClick={() => inputRef.current?.click()} disabled={disabled || busy}>
          {busy ? <Loader2 className="animate-spin" /> : <FileText />}
          {busy ? "Importing…" : label}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            handle(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} disabled={busy} className="size-4 accent-[#003157]" />
          Read with AI <span className="text-xs text-gray-500">(recommended — off reads headings only)</span>
        </label>
      </div>

      {busy && <p className="text-xs text-gray-600">{state.message}</p>}
      {state?.stage === "error" && (
        <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.stage === "done" && <ImportSummary summary={state.summary} withPhotos={withPhotos} />}
    </div>
  );
}

function List({ title, items, tone = "text-gray-700" }) {
  if (!items?.length) return null;
  return (
    <p className={`text-xs ${tone}`}>
      <span className="font-medium">{title}:</span> {items.join(", ")}.
    </p>
  );
}

function ImportSummary({ summary: s, withPhotos }) {
  const c = s.ai?.completeness;
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg bg-marker-soft p-3 text-sm text-gray-800">
      <p className="flex flex-wrap items-center gap-2 font-medium">
        <CheckCircle2 className="size-4 text-green-700" /> Imported {s.file}
        {c && <span className="rounded-full bg-white px-2 py-0.5 text-xs tabular-nums text-gray-700">{c.percent}% of the website case study filled</span>}
      </p>
      {s.aiError && (
        <p className="flex items-start gap-1.5 rounded-md bg-white p-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> The AI couldn&apos;t read it ({s.aiError}), so it was read by headings instead.
        </p>
      )}
      {s.ai ? (
        <>
          <List title="From your document" items={s.ai.fromDocument.map(label)} />
          <List title="Written or classified by AI from it" items={s.ai.written.map(label)} />
          <List title="Not in the document — add if you have it" items={s.ai.notInDocument.map(label)} tone="text-gray-900" />
          {c?.required.length > 0 && <List title="Needed before sending" items={c.required.map((m) => m.label)} tone="text-destructive" />}
          {s.ai.checks?.length > 0 && (
            <div className="text-xs text-gray-800">
              <p className="font-medium">Check before approving:</p>
              <ul className="list-disc pl-5">
                {s.ai.checks.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-gray-700">{s.found.length ? `Filled: ${s.found.join(", ")}.` : "No recognised sections — the full text is in the write-up."}</p>
          <List title="Kept as extra write-up" items={s.unmatchedHeadings} />
          <List title="Not a website option, pick it by hand" items={s.unmatchedValues} />
        </>
      )}
      {withPhotos && (
        <p className="text-xs text-gray-700">
          {s.photos} photo{s.photos === 1 ? "" : "s"} added from the document.{s.skippedImages > 0 && ` ${s.skippedImages} small or unsupported image(s) skipped.`}
        </p>
      )}
      <List title="Kept what you'd already entered for" items={s.overridden.map(label)} />
      <p className="flex items-start gap-1.5 text-xs text-gray-600">
        {s.ai ? <Sparkles className="mt-0.5 size-3.5 shrink-0" /> : <Info className="mt-0.5 size-3.5 shrink-0" />}
        {s.ai ? `Read by ${s.ai.model}${s.ai.cost != null ? ` · ${money(s.ai.cost, 3)}` : ""}. It only uses facts in your document — check it, then approve.` : "Read straight from your document by its headings — no AI. Check it before approving."}
      </p>
    </div>
  );
}
