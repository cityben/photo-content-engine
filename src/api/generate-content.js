import { Anthropic } from "@anthropic-ai/sdk";
import { parseImageData } from "../lib/image-analyzer";
import { generateContentPrompts } from "../lib/content-generator";
import { createProjectDraft } from "../lib/website-api";

const client = new Anthropic();

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Validate API key
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid authorization header" });
    }

    // TODO: Validate API key against database
    // const apiKey = authHeader.replace('Bearer ', '');

    const { imageData, metadata } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: "Missing image data" });
    }

    console.log("[generate-content] Processing image with metadata:", metadata);

    // Parse image (base64 or URL)
    const imageSource = parseImageData(imageData);

    // Get Claude to analyze the image
    console.log("[generate-content] Sending to Claude Vision API...");
    const imageAnalysis = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: imageSource,
            },
            {
              type: "text",
              text: `You are an expert facilities and M&E (Mechanical & Electrical) industry analyst.

Analyze this job site photo and extract:
1. Equipment visible (HVAC units, electrical panels, piping, etc.)
2. Type of work (installation, maintenance, repair, etc.)
3. Scope and scale of work
4. Building type/sector (Commercial, Industrial, Residential, Healthcare, etc.)
5. Technical details visible
6. Quality/professionalism of the work

Respond in JSON format:
{
  "equipment": ["...", "..."],
  "work_type": "...",
  "scope": "...",
  "sector": "...",
  "technical_details": "...",
  "quality_assessment": "..."
}`,
            },
          ],
        },
      ],
    });

    let analysis = {};
    try {
      const jsonStr = imageAnalysis.content[0].text
        .match(/\{[\s\S]*\}/)[0];
      analysis = JSON.parse(jsonStr);
    } catch (e) {
      console.error("[generate-content] Failed to parse Claude analysis:", e);
      analysis = { raw: imageAnalysis.content[0].text };
    }

    console.log("[generate-content] Image analysis complete:", analysis);

    // Generate content for each platform
    const prompts = generateContentPrompts(analysis, metadata);

    // Call Claude for each content type
    const contentResults = await Promise.all(
      Object.entries(prompts).map(async ([format, prompt]) => {
        try {
          const response = await client.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 500,
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
          });

          return {
            format,
            content: response.content[0].text,
            tokens: response.usage.output_tokens,
          };
        } catch (error) {
          console.error(`[generate-content] Error generating ${format}:`, error);
          return {
            format,
            error: error.message,
          };
        }
      })
    );

    // Parse responses into structured format
    const content = {};
    contentResults.forEach(({ format, content: text, error }) => {
      if (error) {
        content[format] = { error };
      } else {
        // Try to parse if it's JSON, otherwise keep as string
        try {
          content[format] = JSON.parse(text);
        } catch {
          content[format] = { text };
        }
      }
    });

    // Optionally create website draft
    let websiteDraft = null;
    if (process.env.ENABLE_WEBSITE_AUTO_POST === "true") {
      try {
        websiteDraft = await createProjectDraft({
          title: metadata?.job_title || "New Project",
          description: content.before_after?.text || "",
          sector: metadata?.sector || analysis.sector || "Commercial",
          imageUrl: imageData,
        });
        console.log("[generate-content] Website draft created:", websiteDraft);
      } catch (error) {
        console.error("[generate-content] Failed to create website draft:", error);
        // Don't fail the whole request if website post fails
      }
    }

    // Return success
    return res.status(200).json({
      success: true,
      image_analysis: analysis,
      content,
      website_draft: websiteDraft || null,
      timestamp: new Date().toISOString(),
      next_step: "Review content and export or post to Buffer",
    });
  } catch (error) {
    console.error("[generate-content] Unhandled error:", error);
    return res.status(500).json({
      error: "Failed to generate content",
      details: error.message,
    });
  }
}
