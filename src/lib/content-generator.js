/**
 * Content Generator Prompts
 *
 * Generates 7 different content formats from image analysis data
 */

export function generateContentPrompts(analysis, metadata = {}) {
  const equipment = (analysis.equipment || []).join(", ");
  const sector = metadata.sector || analysis.sector || "Commercial";
  const workType = analysis.work_type || "facilities work";
  const location = metadata.location || "the UK";
  const jobTitle = metadata.job_title || "Professional Project";

  return {
    linkedin: `You are a professional B2B content writer for Acme Ltd, a leading M&E (HVAC, Electrical, Facilities) services company.

Write a compelling LinkedIn post (150-200 words) about this project:
- Equipment: ${equipment}
- Work Type: ${workType}
- Sector: ${sector}
- Location: ${location}
- Job Title: ${jobTitle}

Guidelines:
- Start with a professional hook that explains WHY this work matters
- Mention the equipment and scope briefly
- Highlight technical expertise and quality
- Include a call-to-action (View case study / Get a quote)
- Add relevant hashtags: #HVAC #MEEngineering #${sector} #Facilities #acme
- Professional, authoritative tone
- Perfect for LinkedIn audience (facility managers, facility directors)

Format as JSON:
{
  "post": "...",
  "hashtags": ["#tag1", "#tag2"],
  "word_count": 0,
  "cta": "..."
}`,

    instagram: `You are a creative social media writer for Acme Ltd. Write an engaging Instagram caption.

Project details:
- Equipment: ${equipment}
- Work Type: ${workType}
- Sector: ${sector}

Guidelines:
- Hook them in the first line (question or exciting statement)
- Keep it conversational and friendly
- Include relevant emojis (5-8)
- Add 15-20 relevant hashtags
- Include a clear CTA (#LinkInBio, DM for quote, etc.)
- 100-150 words
- Instagram audience: building owners, facility managers, DIY enthusiasts

Format as JSON:
{
  "caption": "...",
  "emojis": 7,
  "hashtags": ["#tag1"],
  "cta": "...",
  "word_count": 0
}`,

    before_after: `Write a professional before/after case study description.

Project:
- Equipment: ${equipment}
- Work Type: ${workType}
- Sector: ${sector}
- Location: ${location}

Structure:
1. Problem statement (what was the challenge?)
2. Solution delivered (what did we do?)
3. Outcomes (what's better now?)
4. Client benefits (efficiency, cost savings, reliability, etc.)

Write 150-200 words. Professional, clear, results-focused. This will go on our website.

Format as JSON:
{
  "description": "...",
  "word_count": 0,
  "benefits": ["benefit1", "benefit2"]
}`,

    gmb: `Write a short Google My Business post about this project.

Details:
- Equipment: ${equipment}
- Work Type: ${workType}
- Sector: ${sector}

Guidelines:
- 50-100 words max
- Conversational but professional
- Include a clear CTA (Get a quote, Schedule service, etc.)
- Highlight any special offer or unique selling point
- Add 3-5 relevant hashtags

Format as JSON:
{
  "post": "...",
  "hashtags": ["#tag1"],
  "cta": "...",
  "word_count": 0
}`,

    blog: `Create a blog post outline for this project.

Project:
- Equipment: ${equipment}
- Work Type: ${workType}
- Sector: ${sector}
- Location: ${location}

Create an SEO-optimized blog outline:
1. Suggest a compelling H1 title (50-60 characters, include keyword)
2. Write a meta description (140-160 characters)
3. Create 4-6 H2 sections with brief descriptions
4. Suggest 5-10 relevant keywords to target
5. Estimate read time

This should position Acme Ltd as the expert and rank for local HVAC/Electrical keywords.

Format as JSON:
{
  "title": "...",
  "meta_description": "...",
  "sections": [
    { "heading": "H2 Title", "description": "..." }
  ],
  "keywords": ["keyword1", "keyword2"],
  "estimated_read_time": "4 min",
  "seo_notes": "..."
}`,

    schema: `Generate JSON-LD schema markup for this project to help Google understand it.

Project:
- Equipment: ${equipment}
- Work Type: ${workType}
- Sector: ${sector}
- Location: ${location}
- Company: Acme Ltd
- Website: acme.co.uk

Create proper JSON-LD schema that includes:
1. LocalBusiness schema (Acme Ltd)
2. Service schema (what we did)
3. Image schema (for the photo)

Return ONLY valid JSON-LD, ready to paste into website <head> tag.`,

    twitter: `Create a Twitter thread about this project.

Project:
- Equipment: ${equipment}
- Work Type: ${workType}
- Sector: ${sector}

Guidelines:
- Create 3-5 tweets
- Each tweet max 280 characters
- First tweet is the hook
- Tweets 2-3 explain the technical details
- Final tweet has CTA
- Include relevant hashtags
- Professional but conversational tone

Format as JSON:
{
  "thread": [
    { "tweet": 1, "text": "..." },
    { "tweet": 2, "text": "..." }
  ],
  "hashtags": ["#tag1"],
  "thread_count": 0
}`,

    keywords: `Analyze this project and extract the best SEO keywords.

Project:
- Equipment: ${equipment}
- Work Type: ${workType}
- Sector: ${sector}
- Location: ${location}

Find keywords that:
1. People actually search for (high search volume)
2. Acme Ltd can rank for (not too competitive)
3. Have commercial intent (people who want to buy these services)
4. Are location-specific where possible

Return both high-volume and long-tail keywords.

Format as JSON:
{
  "primary_keywords": ["keyword1", "keyword2"],
  "secondary_keywords": ["long-tail keyword 1"],
  "location_keywords": ["city-specific keyword"],
  "difficulty": "Medium/High/Low",
  "search_volume_estimate": 0,
  "recommended_focus": "..."
}`,
  };
}

/**
 * Format content for export/posting
 */
export function formatForExport(content, format = "all") {
  switch (format) {
    case "linkedin":
      return {
        platform: "LinkedIn",
        content: content.linkedin?.post || "",
        hashtags: content.linkedin?.hashtags || [],
        cta: content.linkedin?.cta || "",
      };

    case "instagram":
      return {
        platform: "Instagram",
        content: content.instagram?.caption || "",
        emojis: content.instagram?.emojis || [],
        hashtags: content.instagram?.hashtags || [],
        cta: content.instagram?.cta || "",
      };

    case "all":
    default:
      return {
        generated_at: new Date().toISOString(),
        platforms: {
          linkedin: content.linkedin,
          instagram: content.instagram,
          twitter: content.twitter,
          gmb: content.gmb,
          blog: content.blog,
          schema: content.schema,
          before_after: content.before_after,
        },
        keywords: content.keywords,
      };
  }
}

/**
 * Validate generated content
 */
export function validateContent(content) {
  const issues = [];

  if (!content.linkedin?.post)
    issues.push("LinkedIn post is missing or empty");
  if (!content.instagram?.caption)
    issues.push("Instagram caption is missing or empty");
  if (!content.blog?.title)
    issues.push("Blog title is missing or empty");
  if (!content.keywords?.primary_keywords?.length)
    issues.push("No primary keywords extracted");

  return {
    valid: issues.length === 0,
    issues,
    quality_score: Math.max(
      0,
      100 - issues.length * 20
    ),
  };
}
