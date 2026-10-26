/**
 * Turn a Word case study into job fields — no AI involved.
 *
 * Input is a flat list of blocks (from docx-blocks.js):
 *   { type: "heading", text } | { type: "p", text } | { type: "li", text }
 * Headings are matched to the website's case-study sections by their wording
 * ("Scope of Works", "Key Challenges", "Outcome"…), and "Label: value" lines
 * (Client:, Location:, Sector:…) fill the details. Anything unrecognised is
 * kept, never dropped.
 *
 * `known` — values you already have (from the form, or another system via the
 * API): { title, client, location, area, county, sector, company,
 * projectType, services, completedOn, durationWeeks }. Known values always
 * win; the document only fills what's missing. Blocks can be empty, so this
 * also works with known values alone.
 */

const SECTION_RULES = [
  ["scopeOfWorks", /scope/i],
  ["keyChallenges", /challenge|problem|constraint|difficult/i],
  ["deliveryHighlights", /highlight|programme|program|delivery|logistic|health|safety/i],
  ["projectOutcome", /outcome|result|benefit|impact|conclusion|handover/i],
  ["keyWorks", /key works|works delivered|what we (did|delivered)|solution|works carried|our work|installation|the works|approach/i],
  ["testimonial", /testimonial|feedback|what the client said|client says|quote/i],
  ["summary", /summary|overview|introduction|background|brief|about the project|project description|the project/i],
];

const FIELD_RULES = [
  ["client", /^(client|customer|end client|building owner)$/i],
  ["location", /^(location|site|address|area|project location)$/i],
  ["sector", /^(sector|market|industry)$/i],
  ["company", /^(division|company|delivered by|trade)$/i],
  ["projectType", /^(project type|type of project|type|works type)$/i],
  ["services", /^(services?|services delivered|disciplines?)$/i],
  ["completedOn", /^(completed|completion|completion date|date completed|date)$/i],
  ["durationWeeks", /^(duration|programme|program|timescale)$/i],
  ["title", /^(project|project name|title|project title)$/i],
];

const norm = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

/** Best match from a fixed list, or null — the website only links exact values. */
export function matchOption(value, list) {
  if (!value) return null;
  const v = norm(value);
  const exact = list.find((o) => norm(o) === v);
  if (exact) return exact;
  const singular = (s) => s.replace(/s\b/g, "");
  return (
    list.find((o) => singular(norm(o)) === singular(v)) ||
    list.find((o) => v.includes(norm(o)) || (norm(o).includes(v) && v.length > 3)) ||
    null
  );
}

function sectionFor(heading) {
  const found = SECTION_RULES.find(([, re]) => re.test(heading));
  return found ? found[0] : null;
}

function toMarkdown(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.type === "li") out.push(`- ${b.text}`);
    else {
      if (out.length && !out[out.length - 1].startsWith("- ")) out.push("");
      else if (out.length) out.push("");
      out.push(b.text);
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function firstSentences(text, max = 300) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const stop = cut.lastIndexOf(". ");
  return stop > 80 ? cut.slice(0, stop + 1) : `${cut.slice(0, max - 1).trim()}…`;
}

function parseMonth(value) {
  const d = new Date(value);
  if (!Number.isNaN(d.getTime()) && /\d{4}/.test(value)) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const m = value.match(/(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

const KNOWN_KEYS = ["title", "client", "location", "sector", "company", "projectType", "completedOn", "durationWeeks"];
const present = (v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "");

const NO_OPTIONS = { companies: [], sectors: [], projectTypes: [], serviceGroups: [] };

/**
 * `options` are the website's lists (Settings → Company profile); values are
 * only kept when they match one.
 */
export function mapCaseStudy(blocks = [], known = {}, options = NO_OPTIONS) {
  const ALL_SERVICES = (options.serviceGroups || []).flatMap((g) => g.services);
  const fields = {};
  const sections = {};
  const extra = [];
  let current = null;
  let title = null;

  for (const block of blocks) {
    const text = block.text?.trim();
    if (!text) continue;

    if (block.type === "heading") {
      if (!title && !sectionFor(text)) {
        title = text;
        current = null;
        continue;
      }
      const key = sectionFor(text);
      current = key ? { key, heading: text } : { key: null, heading: text };
      if (!key) extra.push({ heading: text, blocks: [] });
      continue;
    }

    const kv = text.match(/^([A-Za-z][A-Za-z /&]{1,30}):\s*(.+)$/);
    if (kv) {
      const rule = FIELD_RULES.find(([, re]) => re.test(kv[1].trim()));
      if (rule && !fields[rule[0]]) {
        fields[rule[0]] = kv[2].trim();
        continue;
      }
    }

    if (!current) {
      (sections.summary ||= []).push(block);
    } else if (current.key) {
      (sections[current.key] ||= []).push(block);
    } else {
      extra.at(-1).blocks.push(block);
    }
  }

  const fromDocument = { ...fields, title: fields.title || title || "" };
  for (const key of KNOWN_KEYS) {
    if (present(known[key])) fields[key] = String(known[key]).trim();
  }
  if (present(known.services)) {
    fields.services = Array.isArray(known.services) ? known.services.join(", ") : String(known.services);
  }

  title = fields.title || title || blocks.find((b) => b.text?.trim())?.text.trim() || "";

  const md = Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, toMarkdown(v)]));
  const summaryText = (sections.summary || []).filter((b) => b.type === "p").map((b) => b.text).join(" ");

  let area = present(known.area) ? String(known.area).trim() : "";
  let county = present(known.county) ? String(known.county).trim() : "";
  if (fields.location && !area && !county) {
    const parts = fields.location.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      county = parts.pop();
      area = parts.join(", ");
    } else {
      area = parts[0] || "";
    }
  }

  const services = (
    present(known.services) && Array.isArray(known.services)
      ? known.services
      : (fields.services || "").split(/,|;| and /)
  )
    .map((s) => matchOption(String(s).trim(), ALL_SERVICES))
    .filter(Boolean);

  let testimonialQuote = "";
  let testimonialAuthor = "";
  if (md.testimonial) {
    const lines = md.testimonial.split("\n").filter(Boolean);
    const author = lines.find((l) => /^[-–—]\s*\S/.test(l));
    testimonialAuthor = author ? author.replace(/^[-–—]\s*/, "") : "";
    testimonialQuote = lines.filter((l) => l !== author).join(" ").replace(/^["“]|["”]$/g, "");
  }

  const writeUpExtra = extra
    .filter((e) => e.blocks.length)
    .map((e) => `## ${e.heading}\n\n${toMarkdown(e.blocks)}`)
    .join("\n\n");

  const weeks = /^\d+$/.test(fields.durationWeeks || "") ? [null, fields.durationWeeks] : fields.durationWeeks?.match(/(\d+)\s*(week|wk)/i);
  const months = fields.durationWeeks?.match(/(\d+)\s*month/i);

  const caseStudy = {
    title,
    description: summaryText ? firstSentences(summaryText) : "",
    company: matchOption(fields.company, options.companies) || "",
    sector: matchOption(fields.sector, options.sectors) || "",
    projectType: matchOption(fields.projectType, options.projectTypes) || "",
    services: [...new Set(services)],
    client: fields.client || "",
    area,
    county,
    scopeOfWorks: md.scopeOfWorks || "",
    keyWorks: md.keyWorks || "",
    keyChallenges: md.keyChallenges || "",
    deliveryHighlights: md.deliveryHighlights || "",
    projectOutcome: md.projectOutcome || "",
    writeUp: writeUpExtra,
    testimonialQuote,
    testimonialAuthor,
    ...(weeks ? { durationWeeks: Number(weeks[1]) } : months ? { durationWeeks: Number(months[1]) * 4 } : {}),
  };

  const fullText = blocks
    .filter((b) => b.text?.trim())
    .map((b) => (b.type === "heading" ? `\n${b.text.trim()}` : b.type === "li" ? `- ${b.text.trim()}` : b.text.trim()))
    .join("\n")
    .trim();

  const found = [
    ...["scopeOfWorks", "keyWorks", "keyChallenges", "deliveryHighlights", "projectOutcome"].filter((k) => caseStudy[k]),
    ...["client", "location", "sector", "company", "projectType", "completedOn"].filter((k) => fields[k]),
  ];

  return {
    title,
    writeUp: fullText,
    caseStudy,
    details: {
      ...(caseStudy.company && { company: caseStudy.company }),
      ...(caseStudy.sector && { sector: caseStudy.sector }),
      ...(caseStudy.projectType && { projectType: caseStudy.projectType }),
      ...(fields.location && { location: fields.location }),
      ...(fields.client && { client: fields.client }),
      ...(fields.completedOn && parseMonth(fields.completedOn) && { completedOn: parseMonth(fields.completedOn) }),
      ...(present(known.completedOn) && /^\d{4}-\d{2}$/.test(known.completedOn) && { completedOn: known.completedOn }),
      ...(caseStudy.services.length && { services: caseStudy.services }),
    },
    found,
    // Which document values were replaced by known values (for the summary).
    overridden: KNOWN_KEYS.filter((k) => present(known[k]) && present(fromDocument[k]) && String(known[k]).trim() !== fromDocument[k]),
    unmatchedHeadings: extra.map((e) => e.heading),
    unmatchedValues: [
      fields.sector && !caseStudy.sector && `Sector "${fields.sector}"`,
      fields.company && !caseStudy.company && `Division "${fields.company}"`,
      fields.projectType && !caseStudy.projectType && `Project type "${fields.projectType}"`,
    ].filter(Boolean),
  };
}
