"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileText, Info, Loader2 } from "lucide-react";

import { uploadPhoto } from "@/components/photo-uploader";
import { Button } from "@/components/ui/button";
import { mapCaseStudy } from "@/lib/docx-map";
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

/**
 * Import a Word case study. Read in the browser and mapped by headings —
 * nothing is sent to AI. `onImported({ title, writeUp, details, caseStudy, photos })`.
 * `withPhotos`: also upload photos embedded in the document.
 * `known`: values already entered (title, sector, client…) — they win over
 * the document, which only fills what's missing.
 */
export function DocxImport({ onImported, known = {}, withPhotos = true, maxPhotos = 10, disabled, variant = "outline", label = "Import Word case study" }) {
  const inputRef = useRef(null);
  const [state, setState] = useState(null); // { stage, message, summary, error }

  const handle = async (file) => {
    if (!file) return;
    setState({ stage: "reading", message: "Reading the document…" });
    try {
      const { blocks, photos, skippedImages } = await readDocx(file);
      if (!blocks.length) throw new Error("No text found in that document.");
      const mapped = mapCaseStudy(blocks, known);

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
      <div>
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
      </div>

      {busy && <p className="text-xs text-gray-600">{state.message}</p>}
      {state?.stage === "error" && (
        <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.stage === "done" && (
        <div role="status" className="flex flex-col gap-2 rounded-lg bg-marker-soft p-3 text-sm text-gray-800">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="size-4 text-green-700" /> Imported {state.summary.file}
          </p>
          <p className="text-xs text-gray-700">
            {state.summary.found.length ? `Filled: ${state.summary.found.join(", ")}.` : "No recognised sections — the full text is in the write-up."}
            {withPhotos && ` ${state.summary.photos} photo${state.summary.photos === 1 ? "" : "s"} added.`}
            {state.summary.skippedImages > 0 && ` ${state.summary.skippedImages} small or unsupported image(s) skipped.`}
          </p>
          {state.summary.unmatchedHeadings.length > 0 && (
            <p className="text-xs text-gray-700">
              Kept as extra write-up: {state.summary.unmatchedHeadings.join(", ")}.
            </p>
          )}
          {state.summary.overridden.length > 0 && (
            <p className="text-xs text-gray-700">
              Kept what you&apos;d already entered for: {state.summary.overridden.map((k) => FIELD_LABELS[k] || k).join(", ")}.
            </p>
          )}
          {state.summary.unmatchedValues.length > 0 && (
            <p className="text-xs text-gray-700">
              Not a website option, pick it by hand: {state.summary.unmatchedValues.join(", ")}.
            </p>
          )}
          <p className="flex items-start gap-1.5 text-xs text-gray-600">
            <Info className="mt-0.5 size-3.5 shrink-0" /> Read straight from your document — no AI. Check it before approving.
          </p>
        </div>
      )}
    </div>
  );
}
