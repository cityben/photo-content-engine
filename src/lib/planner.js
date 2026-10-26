/**
 * Gathers what the AI planner needs from stored data (no paid calls) and
 * turns its suggestions into pipeline ideas.
 */

import { generateContentIdeas } from "@/lib/ai";
import { createIdea, listIdeas } from "@/lib/ideas";
import { listJobs, searchConsoleData } from "@/lib/jobs";
import { latest } from "@/lib/seo/market";
import { collection } from "@/lib/store";

const BUYING = ["commercial", "transactional"];
const slim = (r) => ({ keyword: r.keyword, volume: r.volume, difficulty: r.difficulty, intent: r.intent, trend: r.trend, score: r.score });

export async function plannerContext() {
  const [ideasSnap, aiSnap, profiles, existing, jobs, gsc, gaps] = await Promise.all([
    latest("ideas"),
    latest("ai"),
    latest("profiles"),
    listIdeas(),
    listJobs(),
    searchConsoleData(),
    collection("market_snapshots")
      .find({ section: "gap" }, { sort: { createdAt: -1 }, limit: 4 })
      .catch(() => []),
  ]);
  const demand = (ideasSnap?.data || []).filter((r) => !r.ourPosition || r.ourPosition > 10);
  const quickWins = (gsc?.rows || []).filter((r) => r.position > 3.5 && r.position <= 20 && r.impressions >= 30);
  return {
    keywordDemandWeDontRankFor: demand.slice(0, 40).map(slim),
    competitorGaps: gaps.map((g) => ({ competitor: g.key, keywords: g.data.filter((r) => BUYING.includes(r.intent) || r.volume >= 100).slice(0, 15).map(slim) })),
    searchConsoleQuickWins: quickWins.slice(0, 20).map((r) => ({ query: r.key, position: r.position, impressions: r.impressions })),
    questionsAiAssistantsGet: (aiSnap?.data?.questions || []).map((q) => q.question),
    whatReviewersMention: profiles?.data?.find((p) => p.you)?.topics?.map((t) => t.topic) || [],
    recentJobs: jobs.slice(0, 15).map((j) => ({ title: j.title, sector: j.details?.sector, services: j.details?.services })),
    alreadyInPipeline: existing.map((i) => i.keyword || i.title),
    month: new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
  };
}

/** Ask the AI for ideas and add the new ones to the pipeline. */
export async function planIdeas(user) {
  const context = await plannerContext();
  const known = new Map(
    [...context.keywordDemandWeDontRankFor, ...context.competitorGaps.flatMap((g) => g.keywords)].map((r) => [r.keyword, r])
  );
  const { ideas, run } = await generateContentIdeas(context);
  let added = 0;
  for (const s of ideas) {
    const k = s.keyword?.trim().toLowerCase() || null;
    const stats = k ? known.get(k) : null;
    const { duplicate } = await createIdea(
      { title: s.title, angle: s.angle, keyword: k, volume: stats?.volume ?? null, score: stats?.score ?? null, format: s.format, source: "ai", sourceDetail: s.why },
      user
    );
    if (!duplicate) added += 1;
  }
  return { added, suggested: ideas.length, run };
}
