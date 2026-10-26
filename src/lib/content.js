/**
 * Content sections and approval rules shared by server and browser.
 * Nothing reaches Buffer or the website until a person approves that exact
 * section; any change to it clears the approval (enforced in jobs.js).
 */

export const APPROVABLE = ["linkedin", "instagram", "caseStudy", "googleBusiness", "blog"];

export const SECTION_LABEL = {
  linkedin: "LinkedIn post",
  instagram: "Instagram caption",
  caseStudy: "case study",
  googleBusiness: "Google Business post",
  blog: "blog post",
};

/** Has the section got something worth approving? */
export function hasSubstance(section, data) {
  if (!data) return false;
  if (section === "linkedin" || section === "googleBusiness") return Boolean(data.text?.trim());
  if (section === "instagram") return Boolean(data.caption?.trim());
  if (section === "caseStudy") return Boolean(data.title?.trim() && data.description?.trim());
  if (section === "blog") return Boolean(data.title?.trim() && data.content?.trim());
  return false;
}

/**
 * Jobs made from a pipeline idea (kind "idea") have no finished work behind
 * them: they get a blog post and posts, never a case study.
 */
export const isIdeaJob = (job) => job?.kind === "idea";

export function needsApproval(job) {
  return APPROVABLE.filter((s) => hasSubstance(s, job.content?.[s]) && !job.approvals?.[s]);
}

export const blankBlog = (job) => ({ title: job.title || "", excerpt: "", category: "", content: "", primaryKeyword: job.target?.keyword || "", imageAlt: "" });

/** Blank sections for writing by hand; keeps any that already exist. */
export function blankContent(job, existing = {}) {
  if (isIdeaJob(job)) {
    return {
      ...existing,
      blog: existing.blog || blankBlog(job),
      linkedin: existing.linkedin || { text: "", hashtags: [], firstComment: "" },
      googleBusiness: existing.googleBusiness || { text: "" },
    };
  }
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

/** The main building photo (case study hero/cards): chosen one, else the first. */
export function mainImageOf(job) {
  const images = job.images || [];
  return images.find((i) => i.url === job.mainImage) || images[0] || null;
}

/** Photos with the main building photo first, then the rest in their order. */
export function orderedImages(job) {
  const main = mainImageOf(job);
  return main ? [main, ...(job.images || []).filter((i) => i.url !== main.url)] : [];
}
