/**
 * Content sections and approval rules shared by server and browser.
 * Nothing reaches Buffer or the website until a person approves that exact
 * section; any change to it clears the approval (enforced in jobs.js).
 */

export const APPROVABLE = ["linkedin", "instagram", "caseStudy", "googleBusiness"];

export const SECTION_LABEL = {
  linkedin: "LinkedIn post",
  instagram: "Instagram caption",
  caseStudy: "case study",
  googleBusiness: "Google Business post",
};

/** Has the section got something worth approving? */
export function hasSubstance(section, data) {
  if (!data) return false;
  if (section === "linkedin" || section === "googleBusiness") return Boolean(data.text?.trim());
  if (section === "instagram") return Boolean(data.caption?.trim());
  if (section === "caseStudy") return Boolean(data.title?.trim() && data.description?.trim());
  return false;
}

export function needsApproval(job) {
  return APPROVABLE.filter((s) => hasSubstance(s, job.content?.[s]) && !job.approvals?.[s]);
}

/** Blank sections for writing by hand; keeps any that already exist. */
export function blankContent(job, existing = {}) {
  return {
    ...existing,
    linkedin: existing.linkedin || { text: "", hashtags: [], firstComment: "" },
    instagram: existing.instagram || { caption: "", hashtags: [], firstComment: "", altText: "" },
    googleBusiness: existing.googleBusiness || { text: "" },
    caseStudy: existing.caseStudy || {
      title: job.title || "",
      description: "",
      company: job.details?.company || "",
      sector: job.details?.sector || "",
      projectType: job.details?.projectType || "",
      services: job.details?.services || [],
      client: job.details?.client || "",
      area: "",
      county: "",
      scopeOfWorks: "",
      keyWorks: "",
      keyChallenges: "",
      deliveryHighlights: "",
      projectOutcome: "",
    },
  };
}
