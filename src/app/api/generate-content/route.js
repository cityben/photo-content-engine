import { analyzeImage, generateAllContent } from "@/lib/ai";
import { validateImageQuality } from "@/lib/image-analyzer";
import { requireUser } from "@/lib/session";
import { createProjectDraft } from "@/lib/website-api";

// One vision call plus eight parallel text calls.
export const maxDuration = 120;

export async function POST(request) {
  const { user, response } = await requireUser();
  if (response) return response;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const { imageData, metadata = {} } = body || {};

  if (!imageData) {
    return Response.json({ error: "Missing image data" }, { status: 400 });
  }

  if (imageData.startsWith("data:")) {
    const quality = validateImageQuality(imageData);
    if (!quality.valid) {
      return Response.json({ error: quality.issues.join(". ") }, { status: 400 });
    }
  }

  try {
    console.log(`[generate-content] ${user.email} analysing image with metadata:`, metadata);
    const analysis = await analyzeImage(imageData);

    const content = await generateAllContent(analysis, metadata);

    let websiteDraft = null;
    if (process.env.ENABLE_WEBSITE_AUTO_POST === "true") {
      try {
        websiteDraft = await createProjectDraft({
          title: metadata.job_title || "New Project",
          description: content.before_after?.description || content.before_after?.text || "",
          sector: metadata.sector || analysis.sector || "Commercial",
          imageUrl: imageData.startsWith("http") ? imageData : undefined,
        });
      } catch (error) {
        // Don't fail the whole request if the website post fails
        console.error("[generate-content] Failed to create website draft:", error);
      }
    }

    return Response.json({
      success: true,
      image_analysis: analysis,
      content,
      website_draft: websiteDraft,
      timestamp: new Date().toISOString(),
      next_step: "Review content and export or post to Buffer",
    });
  } catch (error) {
    console.error("[generate-content] Unhandled error:", error);
    return Response.json(
      { error: "Failed to generate content", details: error.message },
      { status: 500 }
    );
  }
}
