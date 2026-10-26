import { z } from "zod";

import { createJobFromIntegration, findByExternalId, integrationSchema, summarise } from "@/lib/integration";
import { requireIntegration } from "@/lib/integration-auth";

/**
 * POST /api/v1/jobs — create a draft job from another system.
 * JSON body, or multipart with `data` (the same JSON as a string), an
 * optional `document` (.docx) and any number of `photos`.
 * Nothing is approved or posted; a person reviews it in the app.
 */
export const maxDuration = 120;

function error(status, code, message) {
  return Response.json({ error: { code, message } }, { status });
}

async function readRequest(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("multipart/form-data")) {
    const form = await request.formData();
    const raw = form.get("data");
    const input = raw ? JSON.parse(typeof raw === "string" ? raw : await raw.text()) : {};
    const document = form.get("document");
    const photos = form.getAll("photos").filter((f) => typeof f !== "string");
    return {
      input,
      files: {
        document: document && typeof document !== "string" ? Buffer.from(await document.arrayBuffer()) : null,
        photos: await Promise.all(photos.map(async (f) => Buffer.from(await f.arrayBuffer()))),
      },
    };
  }
  return { input: await request.json(), files: {} };
}

export async function POST(request) {
  const { name, response } = requireIntegration(request);
  if (response) return response;

  let parsed;
  try {
    parsed = await readRequest(request);
  } catch {
    return error(400, "bad_request", "Send JSON, or multipart/form-data with a `data` JSON field.");
  }

  const result = integrationSchema.safeParse(parsed.input);
  if (!result.success) {
    return Response.json(
      {
        error: {
          code: "validation_failed",
          message: "Some fields are invalid.",
          details: Object.fromEntries(result.error.issues.map((i) => [i.path.join(".") || "body", i.message])),
        },
      },
      { status: 422 }
    );
  }

  try {
    const { job, created, warnings } = await createJobFromIntegration(result.data, parsed.files, { keyName: name });
    console.log(`[api/v1] ${name} ${created ? "created" : "matched"} job ${job.id}`);
    return Response.json(
      { data: summarise(job, new URL(request.url).origin), created, warnings },
      { status: created ? 201 : 200 }
    );
  } catch (e) {
    console.error(`[api/v1] ${name} create failed:`, e);
    return error(400, "create_failed", e.message);
  }
}

/** GET /api/v1/jobs?externalId=… — look a job up by your own id. */
export async function GET(request) {
  const { response } = requireIntegration(request);
  if (response) return response;
  const externalId = new URL(request.url).searchParams.get("externalId");
  const check = z.string().min(1).max(200).safeParse(externalId);
  if (!check.success) return error(400, "bad_request", "Pass ?externalId=");
  const job = await findByExternalId(check.data);
  if (!job) return error(404, "not_found", "No job with that externalId.");
  return Response.json({ data: summarise(job, new URL(request.url).origin) });
}
