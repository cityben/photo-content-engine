import { z } from "zod";

import { ApprovalError } from "@/lib/jobs";
import { requireUser } from "@/lib/session";
import { BufferError } from "@/lib/social/buffer";
import { PostingDisabledError } from "@/lib/social";
import { WebsiteError } from "@/lib/website-api";

/**
 * Route handler wrapper: requires a signed-in user, turns thrown errors into
 * JSON with a sensible status, and never leaks stack traces.
 */
export function route(handler) {
  return async (request, context) => {
    const { user, response } = await requireUser();
    if (response) return response;
    try {
      const params = context?.params ? await context.params : {};
      const result = await handler({ request, params, user });
      return result instanceof Response ? result : Response.json(result ?? { ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return Response.json(
          { error: error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") },
          { status: 400 }
        );
      }
      if (error instanceof PostingDisabledError || error instanceof ApprovalError) {
        return Response.json({ error: error.message }, { status: 403 });
      }
      if (error instanceof BufferError || error instanceof WebsiteError) {
        console.error(`[api] ${error.name}:`, error.message);
        return Response.json({ error: error.message }, { status: error.status === 429 ? 429 : 502 });
      }
      if (error?.name === "NotFound") {
        return Response.json({ error: error.message }, { status: 404 });
      }
      const expected = error instanceof Error && !/^(TypeError|ReferenceError|SyntaxError)$/.test(error.name);
      console.error("[api] Error:", error);
      return Response.json(
        { error: expected ? error.message : "Something went wrong on the server." },
        { status: expected ? 400 : 500 }
      );
    }
  };
}

export function notFound(message = "Not found") {
  const error = new Error(message);
  error.name = "NotFound";
  return error;
}

export async function readJson(request, schema) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new z.ZodError([{ code: "custom", path: [], message: "Request body must be JSON" }]);
  }
  return schema.parse(body);
}
