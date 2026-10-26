/**
 * The 7 content formats shown in the UI, and how each becomes plain text
 * for copying or exporting. Shared by client components — no secrets here.
 */

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function withHashtags(text = "", hashtags) {
  const missing = list(hashtags).filter((tag) => !text.includes(tag));
  return missing.length ? `${text.trim()}\n\n${missing.join(" ")}` : text.trim();
}

function fallback(data) {
  if (!data) return "";
  if (typeof data.text === "string") return data.text;
  return JSON.stringify(data, null, 2);
}

export const FORMATS = [
  {
    key: "linkedin",
    label: "LinkedIn post",
    hint: "Professional hook, scope and a call to action",
    toText: (d) => (d?.post ? withHashtags(d.post, d.hashtags) : fallback(d)),
  },
  {
    key: "instagram",
    label: "Instagram caption",
    hint: "Conversational caption with emojis and hashtags",
    toText: (d) => (d?.caption ? withHashtags(d.caption, d.hashtags) : fallback(d)),
  },
  {
    key: "before_after",
    label: "Before / after",
    hint: "Case study: problem, solution, outcome",
    toText: (d) => {
      if (!d?.description) return fallback(d);
      const benefits = list(d.benefits);
      return benefits.length
        ? `${d.description.trim()}\n\nBenefits:\n${benefits.map((b) => `- ${b}`).join("\n")}`
        : d.description.trim();
    },
  },
  {
    key: "gmb",
    label: "Google Business post",
    hint: "Short local post for Google Business Profile",
    toText: (d) => (d?.post ? withHashtags(d.post, d.hashtags) : fallback(d)),
  },
  {
    key: "blog",
    label: "Blog outline",
    hint: "SEO title, meta description and sections",
    toText: (d) => {
      if (!d?.title) return fallback(d);
      const lines = [`# ${d.title}`];
      if (d.meta_description) lines.push("", `Meta: ${d.meta_description}`);
      for (const s of list(d.sections)) {
        lines.push("", `## ${s.heading}`, s.description || "");
      }
      const keywords = list(d.keywords);
      if (keywords.length) lines.push("", `Keywords: ${keywords.join(", ")}`);
      return lines.join("\n").trim();
    },
  },
  {
    key: "twitter",
    label: "X / Twitter thread",
    hint: "3–5 posts, hook first, CTA last",
    toText: (d) => {
      const thread = list(d?.thread);
      if (!thread.length) return fallback(d);
      return thread
        .map((t, i) => `${i + 1}/${thread.length} ${t.text}`)
        .join("\n\n");
    },
  },
  {
    key: "schema",
    label: "Schema markup",
    hint: "JSON-LD for the case study page <head>",
    toText: (d) => {
      if (!d) return "";
      if (d.text && Object.keys(d).length === 1) return d.text;
      return `<script type="application/ld+json">\n${JSON.stringify(d, null, 2)}\n</script>`;
    },
  },
];

export function keywordsToText(k) {
  if (!k || k.error) return "";
  const groups = [
    ["Primary", k.primary_keywords],
    ["Long-tail", k.secondary_keywords],
    ["Local", k.location_keywords],
  ];
  return groups
    .filter(([, v]) => list(v).length)
    .map(([label, v]) => `${label}: ${list(v).join(", ")}`)
    .join("\n");
}

export function exportMarkdown(result, metadata = {}) {
  const parts = [`# ${metadata.job_title || "Job photo content"}`];
  const meta = [metadata.sector, metadata.location].filter(Boolean).join(" · ");
  if (meta) parts.push(meta);
  for (const f of FORMATS) {
    const data = result.content?.[f.key];
    if (!data || data.error) continue;
    parts.push(`## ${f.label}`, f.toText(data));
  }
  const keywords = keywordsToText(result.content?.keywords);
  if (keywords) parts.push("## SEO keywords", keywords);
  return parts.join("\n\n");
}

export function wordCount(text = "") {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

/** Buffer channels and the text each one receives. */
export const BUFFER_CHANNELS = [
  {
    key: "linkedin",
    label: "LinkedIn",
    limit: 3000,
    textFrom: (content) => FORMATS[0].toText(content?.linkedin),
  },
  {
    key: "instagram",
    label: "Instagram",
    limit: 2200,
    textFrom: (content) => FORMATS[1].toText(content?.instagram),
  },
  {
    key: "twitter",
    label: "X / Twitter",
    limit: 280,
    // Buffer takes a single post; the full thread stays in its card to copy.
    textFrom: (content) => content?.twitter?.thread?.[0]?.text || "",
  },
];
