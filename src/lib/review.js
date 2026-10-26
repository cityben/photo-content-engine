/**
 * The review queue: every written section that is waiting for a person, in
 * one list — first to approve, then approved but not out yet. One click
 * approves and sends it on (schedule the post, send the draft to the
 * website, or mark a Google Business post as posted). Approval is still a
 * person's click on that exact text; nothing here approves on its own.
 */

import { completeness } from "@/lib/case-study-fields";
import { APPROVABLE, hasSubstance, isIdeaJob, mainImageOf, orderedImages, SECTION_LABEL } from "@/lib/content";
import { defaultPostText, getJob, listJobs, markGooglePosted, scheduleForJob, sendBlog, sendCaseStudy, setApproval } from "@/lib/jobs";
import { listChannels } from "@/lib/social";

/** What happens after approval, per section. */
export const NEXT_STEP = {
  linkedin: "schedule",
  instagram: "schedule",
  blog: "send",
  caseStudy: "send",
  googleBusiness: "posted",
};

const isOut = (job, section) => {
  if (section === "linkedin" || section === "instagram") return (job.posts || []).some((p) => p.service === section);
  if (section === "blog") return Boolean(job.blogPost?.id);
  if (section === "caseStudy") return Boolean(job.website?.projectId);
  if (section === "googleBusiness") return Boolean(job.googlePosted);
  return false;
};

/** Why a section can't go out yet (shown on its card), or []. */
export function blockers(job, section) {
  const data = job.content?.[section];
  const out = [];
  if (section === "instagram" && !job.images?.length) out.push("Instagram needs at least one photo.");
  if (section === "blog") {
    if (!mainImageOf(job)) out.push("Add a header photo — the website needs one.");
    if (!data?.excerpt?.trim()) out.push("Add a summary.");
    if (!data?.category?.trim()) out.push("Add a category.");
  }
  if (section === "caseStudy") {
    const { required } = completeness(data);
    if (required.length) out.push(`The website needs: ${required.map((m) => m.label).join(", ")}.`);
  }
  return out;
}

function preview(job, section) {
  const c = job.content?.[section] || {};
  if (section === "linkedin" || section === "instagram") return { text: defaultPostText(job, section) };
  if (section === "googleBusiness") return { text: c.text || "" };
  if (section === "blog") return { title: c.title, text: c.excerpt || "", body: c.content || "", category: c.category || "" };
  if (section === "caseStudy") return { title: c.title, text: c.description || "", body: [c.scopeOfWorks, c.projectOutcome].filter(Boolean).join("\n\n") };
  return { text: "" };
}

/** Pure: the queue items for a list of jobs, newest work first. */
export function queueFrom(jobs) {
  const items = [];
  for (const job of jobs) {
    for (const section of APPROVABLE) {
      if (!hasSubstance(section, job.content?.[section])) continue;
      if (isOut(job, section)) continue;
      const approved = Boolean(job.approvals?.[section]);
      const image = section === "instagram" || section === "blog" || section === "caseStudy" || section === "linkedin" ? mainImageOf(job) : null;
      items.push({
        key: `${job.id}:${section}`,
        jobId: job.id,
        jobTitle: job.title,
        idea: isIdeaJob(job),
        source: job.source || null,
        keyword: job.target?.keyword || null,
        section,
        label: SECTION_LABEL[section],
        state: approved ? "ready" : "approve",
        approvedAt: job.approvals?.[section]?.at || null,
        next: NEXT_STEP[section],
        image: image ? { url: image.url, alt: image.alt || "" } : null,
        photos: section === "instagram" ? Math.min(10, job.images?.length || 0) : section === "linkedin" ? Math.min(1, job.images?.length || 0) : null,
        preview: preview(job, section),
        blockers: blockers(job, section),
        writtenAt: job.generatedAt || job.updatedAt || job.createdAt || null,
      });
    }
  }
  return items.sort((a, b) => (a.state === b.state ? String(b.writtenAt).localeCompare(String(a.writtenAt)) : a.state === "approve" ? -1 : 1));
}

export async function reviewQueue() {
  return queueFrom(await listJobs());
}

export async function reviewCount() {
  try {
    return (await reviewQueue()).filter((i) => i.state === "approve").length;
  } catch {
    return 0;
  }
}

/**
 * Do one queue action. "approve" only approves; the others approve first if
 * needed (the click is the approval) and then send it on.
 */
export async function reviewAction({ jobId, section, action, channelId }, user) {
  let job = await getJob(jobId);
  if (!job) throw new Error("That draft no longer exists.");
  if (!APPROVABLE.includes(section)) throw new Error("Unknown section.");
  if (action === "unapprove") return { job: await setApproval(jobId, section, false, user) };
  if (!job.approvals?.[section]) job = await setApproval(jobId, section, true, user);
  if (action === "approve") return { job };

  const step = NEXT_STEP[section];
  if (action !== step) throw new Error(`The ${SECTION_LABEL[section]} can't be sent that way.`);
  const blocked = blockers(job, section);
  if (blocked.length) throw new Error(`Approved, but it can't go out yet: ${blocked.join(" ")}`);

  if (step === "schedule") {
    const channels = (await listChannels()).filter((c) => c.service === section && c.canCompose);
    const channel = channelId ? channels.find((c) => c.id === channelId) : channels.length === 1 ? channels[0] : null;
    if (!channels.length) throw new Error(`Approved. No ${SECTION_LABEL[section].split(" ")[0]} channel is connected in Buffer.`);
    if (!channel) throw new Error("Approved. Pick which channel to schedule it on.");
    const photos = orderedImages(job).slice(0, section === "instagram" ? 10 : 1).map((i) => i.url);
    const post = await scheduleForJob(jobId, { channelId: channel.id, imageUrls: photos });
    return { job: await getJob(jobId), result: { kind: "scheduled", dueAt: post.dueAt, channel: channel.name } };
  }
  if (step === "send" && section === "blog") return { job: await getJob(jobId), result: { kind: "sent", ...(await sendBlog(jobId)) } };
  if (step === "send") return { job: await getJob(jobId), result: { kind: "sent", ...(await sendCaseStudy(jobId)) } };
  if (step === "posted") return { job: await markGooglePosted(jobId, user), result: { kind: "posted" } };
  throw new Error("Unknown action.");
}
