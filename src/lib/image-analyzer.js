/**
 * Image Analysis Helper Functions
 */

/**
 * Parse image data from various formats (base64, URL, file)
 */
export function parseImageData(imageData) {
  // If it's already a URL
  if (typeof imageData === "string" && imageData.startsWith("http")) {
    return {
      type: "image",
      source: {
        type: "url",
        url: imageData,
      },
    };
  }

  // If it's base64
  if (typeof imageData === "string" && imageData.startsWith("data:image")) {
    const matches = imageData.match(/^data:image\/([^;]+);base64,(.+)$/);
    if (matches) {
      const mediaType = `image/${matches[1]}`;
      const base64 = matches[2];

      return {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64,
        },
      };
    }
  }

  throw new Error("Invalid image format. Use URL or base64 data");
}

/**
 * Extract metadata from image analysis
 */
export function extractMetadata(analysis) {
  return {
    equipment: analysis.equipment || [],
    work_type: analysis.work_type || "unknown",
    scope: analysis.scope || "unknown",
    sector: analysis.sector || "Commercial",
    technical_details: analysis.technical_details || "",
    quality_assessment: analysis.quality_assessment || "",
    analysis_confidence: calculateConfidence(analysis),
  };
}

/**
 * Calculate confidence score for the analysis
 */
function calculateConfidence(analysis) {
  let score = 0;
  let factors = 0;

  if (analysis.equipment?.length > 0) {
    score += Math.min(analysis.equipment.length * 10, 100);
    factors++;
  }
  if (analysis.work_type) {
    score += 20;
    factors++;
  }
  if (analysis.sector) {
    score += 20;
    factors++;
  }
  if (analysis.technical_details) {
    score += 20;
    factors++;
  }

  return factors > 0 ? Math.round(score / factors) : 0;
}

/**
 * Validate image quality before processing
 */
export function validateImageQuality(imageData) {
  const issues = [];

  // Check if image is too small or too large
  if (imageData.length < 1000) {
    issues.push("Image appears too small or corrupted");
  }
  if (imageData.length > 10 * 1024 * 1024) {
    // 10MB
    issues.push("Image is too large (max 10MB)");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Generate alt text for accessibility
 */
export function generateAltText(analysis, metadata) {
  const sector = metadata?.sector || analysis.sector || "Commercial";
  const equipment = (analysis.equipment || []).slice(0, 3).join(", ");
  const work = analysis.work_type || "facilities work";

  return `${work} in ${sector} sector - equipment: ${equipment}`;
}
