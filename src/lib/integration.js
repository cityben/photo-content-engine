/**
 * Create a job from another system (POST /api/v1/jobs).
 *
 * Takes whatever is known — title, sector, client… — plus an optional Word
 * case study and photos (as uploads or https URLs). Known values win over the
 * document. The job is created as a draft: nothing is approved, scheduled or
 * sent. Optionally the AI drafts the posts (and fills empty case-study fields).
 */

import { z } from "zod";

import { mapCaseStudy } from "@/lib/docx-map";
import { readDocxBuffer } from "@/lib/docx-server";
import { createJob, generateForJob, getJob, needsApproval } from "@/lib/jobs";
import { saveImageFromBytes } from "@/lib/media";
import { fetchPublicFile } from "@/lib/remote-file";
import { collection } from "@/lib/store";
import { CASE_STUDY_FIELDS } from "@/lib/website-api";

const text = (max) => z.string().max(max);

export const integrationSchema = z.object({
  externalId: text(200).optional(),
  title: text(200).optional(),
  writeUp: text(50000).optional(),
  details: z
    .object({
      company: text(100),
      sector: text(100),
      projectType: text(100),
      services: z.array(text(120)).max(10),
      location: text(200),
      area: text(100),
      county: text(100),
      client: text(200),
      completedOn: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM"),
      durationWeeks: z.number().int().positive().max(520),
    })
    .partial()
    .optional(),
  caseStudy: z.record(z.string(), z.union([text(20000), z.array(text(200)).max(20), z.number(), z.boolean()])).optional(),
  documentUrl: z.string().url().optional(),
  photoUrls: z.array(z.string().url()).max(10).optional(),
  generate: z.boolean().optional(),
});

// Fields another system may set directly (not photos or publishing).
const DIRECT_FIELDS = CASE_STUDY_FIELDS.filter((f) => !["mainImage", "images", "previewImages", "published", "slug"].includes(f));

const present = (v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "");

export function summarise(job, origin) {
  return {
    id: job.id,
    externalId: job.externalId || null,
    title: job.title,
    url: origin ? `${origin}/jobs/${job.id}` : null,
    written: Boolean(job.content?.linkedin || job.content?.caseStudy),
    needsApproval: needsApproval(job),
    approvals: Object.fromEntries(Object.entries(job.approvals || {}).filter(([, v]) => v)),
    posts: (job.posts || []).map((p) => ({ service: p.service, dueAt: p.dueAt, postId: p.postId })),
    website: job.website ? { slug: job.website.slug, url: job.website.url, status: job.website.status } : null,
    createdAt: job.createdAt,
  };
}

export async function findByExternalId(externalId) {
  if (!externalId) return null;
  const [job] = await collection("jobs").find({ externalId });
  return job || null;
}

/** `files`: { document?: Buffer, photos?: Buffer[] } from a multipart request. */
export async function createJobFromIntegration(input, files = {}, { keyName } = {}) {
  const warnings = [];

  const existing = await findByExternalId(input.externalId);
  if (existing) return { job: existing, created: false, warnings: ["A job with this externalId already exists; returned it unchanged."] };

  // Word document: uploaded or fetched.
  let docBytes = files.document || null;
  if (!docBytes && input.documentUrl) docBytes = await fetchPublicFile(input.documentUrl, { maxBytes: 50 * 1024 * 1024 });
  const doc = docBytes ? await readDocxBuffer(docBytes) : { blocks: [], photos: [] };

  const d = input.details || {};
  const mapped = mapCaseStudy(doc.blocks, { title: input.title, ...d });

  const direct = Object.fromEntries(
    Object.entries(input.caseStudy || {}).filter(([k, v]) => DIRECT_FIELDS.includes(k) && present(v))
  );
  const hasCaseStudy = docBytes || Object.keys(direct).length > 0;
  const caseStudy = hasCaseStudy ? { ...mapped.caseStudy, ...direct } : null;

  // Photos: uploads first, then URLs, then any in the document. Max 10.
  const sources = [
    ...(files.photos || []).map((bytes) => ({ bytes, label: "uploaded photo" })),
    ...(input.photoUrls || []).map((url) => ({ url, label: url })),
    ...doc.photos.map((bytes) => ({ bytes, label: "photo in the document" })),
  ].slice(0, 10);
  const images = [];
  for (const src of sources) {
    try {
      const bytes = src.bytes || (await fetchPublicFile(src.url, { maxBytes: 25 * 1024 * 1024 }));
      images.push({ ...(await saveImageFromBytes(new Uint8Array(bytes))), alt: "" });
    } catch (error) {
      warnings.push(`Skipped ${src.label}: ${error.message}`);
    }
  }
  if (mapped.unmatchedValues.length) warnings.push(`Not website options, set them in the app: ${mapped.unmatchedValues.join(", ")}`);

  let job = await createJob({
    title: input.title || mapped.title || "Untitled job",
    writeUp: input.writeUp || mapped.writeUp,
    details: { ...mapped.details, ...Object.fromEntries(Object.entries(d).filter(([, v]) => present(v))) },
    images,
    content: caseStudy ? { caseStudy } : {},
    source: "api",
    user: { email: `api:${keyName || "integration"}` },
    extra: { externalId: input.externalId || null },
  });

  if (input.generate) {
    try {
      job = await generateForJob(job.id, { preserve: caseStudy ? ["caseStudy"] : [] });
    } catch (error) {
      warnings.push(`Saved, but the AI draft failed: ${error.message}. Write it in the app or try again there.`);
      job = await getJob(job.id);
    }
  }

  return { job, created: true, warnings };
}
