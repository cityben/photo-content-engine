/**
 * Channel templates: text the team wants in every post of a kind.
 *
 *   guide  — reference for the AI (tone, sign-off style, what to always
 *            mention). The AI reads it; it isn't copied word for word.
 *   top    — added word for word at the start of every new post.
 *   bottom — added word for word at the end (a sign-off, a call to action).
 *
 * Top and bottom are added by code after the AI writes, so they're exact.
 * {{title}}, {{location}} and {{client}} fill from the job. Pure functions
 * here; storage is getTemplates / saveTemplates.
 */

/** Which field of each section the top/bottom text wraps. Case studies take guidance only. */
export const TEMPLATE_FIELD = { linkedin: "text", instagram: "caption", googleBusiness: "text", blog: "content", caseStudy: null };
export const TEMPLATE_SECTIONS = Object.keys(TEMPLATE_FIELD);

export const EMPTY_TEMPLATE = { guide: "", top: "", bottom: "" };

export function cleanTemplates(input = {}) {
  const out = {};
  for (const section of TEMPLATE_SECTIONS) {
    const t = input?.[section] || {};
    out[section] = {
      guide: String(t.guide || "").trim().slice(0, 2000),
      top: TEMPLATE_FIELD[section] ? String(t.top || "").trim().slice(0, 1000) : "",
      bottom: TEMPLATE_FIELD[section] ? String(t.bottom || "").trim().slice(0, 1000) : "",
    };
  }
  return out;
}

export function fillVariables(text, job = {}) {
  const d = job.details || {};
  return String(text || "")
    .replace(/\{\{\s*title\s*\}\}/g, job.title || "")
    .replace(/\{\{\s*location\s*\}\}/g, d.location || "")
    .replace(/\{\{\s*client\s*\}\}/g, d.client || "")
    .replace(/[ \t]+$/gm, "");
}

/** Does a template add anything for this section? */
export const hasForced = (t) => Boolean(t?.top || t?.bottom);

/**
 * Wrap one section's text with its top and bottom text. Safe to run twice:
 * text already there isn't added again.
 */
export function applyTemplate(section, data, template, job) {
  const field = TEMPLATE_FIELD[section];
  if (!field || !data || !hasForced(template)) return data;
  const top = fillVariables(template.top, job).trim();
  const bottom = fillVariables(template.bottom, job).trim();
  let body = String(data[field] || "").trim();
  if (top && !body.startsWith(top)) body = body ? `${top}\n\n${body}` : top;
  if (bottom && !body.endsWith(bottom)) body = `${body}\n\n${bottom}`;
  return { ...data, [field]: body };
}

/** Apply every section's template to freshly written content. */
export function applyTemplates(content, templates, job, sections = Object.keys(content || {})) {
  const out = { ...content };
  for (const s of sections) if (out[s]) out[s] = applyTemplate(s, out[s], templates?.[s], job);
  return out;
}

/** Lines for the AI prompt: the guidance, and what will be added so it isn't repeated. */
export function templatePrompt(templates, sections) {
  const lines = [];
  for (const s of sections) {
    const t = templates?.[s];
    if (!t) continue;
    if (t.guide) lines.push(`${s} — house template, use as reference (don't copy it word for word): ${t.guide}`);
    if (hasForced(t)) {
      lines.push(
        `${s} — this text is added automatically${t.top ? `, at the top: "${t.top}"` : ""}${t.bottom ? `${t.top ? " and" : ","} at the bottom: "${t.bottom}"` : ""}. Don't repeat it; write the rest so it reads well with it.`
      );
    }
  }
  return lines.length ? `\nHouse templates:\n${lines.join("\n")}` : "";
}
