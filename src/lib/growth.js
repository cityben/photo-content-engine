/**
 * Everything the Analytics and Insights pages show, in one place:
 * social metrics (Buffer or sandbox), website traffic and search (from the
 * website's own GA4 / Search Console copy). Each source fails independently.
 */

import { generateInsights } from "@/lib/ai";
import { cached } from "@/lib/cache";
import { analytics } from "@/lib/social";
import { collection } from "@/lib/store";
import {
  getReportSummary,
  getSearchQueries,
  getTrafficReport,
  websiteConfig,
  websiteConfigured,
} from "@/lib/website-api";

const day = (d) => d.toISOString().slice(0, 10);

async function settle(promise) {
  try {
    return { data: await promise, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
}

export async function growthData({ days = 30, refresh = false } = {}) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const range = { from: day(start), to: day(end) };

  const social = await settle(analytics({ start: start.toISOString(), end: end.toISOString() }));

  let website = { configured: await websiteConfigured(), summary: null, traffic: null, queries: null, error: null };
  if (website.configured) {
    const { siteUrl } = await websiteConfig();
    const key = `website-reports-${siteUrl}-${days}d`;
    const result = await settle(
      cached(
        key,
        3 * 3600000,
        async () => {
          const [summary, traffic, queries] = await Promise.all([
            getReportSummary(range).catch(() => null),
            getTrafficReport(range).catch(() => null),
            getSearchQueries({ ...range, limit: 100 }).catch(() => null),
          ]);
          if (!summary && !traffic && !queries) throw new Error("The website returned no report data. Check the key has analytics:read.");
          return { summary, traffic, queries };
        },
        { refresh }
      )
    );
    website = { ...website, ...(result.data?.value || {}), cachedAt: result.data?.cachedAt, error: result.error };
  }

  return { days, range, social: social.data, socialError: social.error, website };
}

/** Social visits to the website, from GA4 source/medium rows. */
export function socialReferrals(traffic) {
  if (!traffic?.sources) return [];
  return traffic.sources.filter((s) => /linkedin|instagram|lnkd\.in|l\.instagram|facebook|buffer/i.test(s.key));
}

/** Compact version of growthData for the AI (no images, no huge arrays). */
function forAi(data) {
  const s = data.social;
  return {
    days: data.days,
    simulated: s?.simulated || false,
    social: s && {
      totals: s.totals,
      perChannel: s.perChannel.map((c) => ({ channel: c.channel.service, posts: c.postCount, metrics: c.metrics })),
      posts: s.posts.slice(-40).map((p) => ({
        service: p.service,
        sentAt: p.sentAt,
        weekdayHourUK: new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit" }).format(new Date(p.sentAt || p.dueAt)),
        chars: p.text.length,
        images: p.images?.length || 0,
        opening: p.text.slice(0, 120),
        metrics: Object.fromEntries((p.metrics || []).map((m) => [m.type, m.value])),
      })),
    },
    website: data.website.configured
      ? {
          kpis: data.website.summary?.kpis,
          narrative: data.website.summary?.narrative,
          channels: data.website.traffic?.channels,
          socialReferrals: socialReferrals(data.website.traffic),
          topQueries: data.website.queries?.rows?.slice(0, 40),
          rankingBands: data.website.queries?.bands,
        }
      : "not connected",
  };
}

const insightsStore = () => collection("insights");

export async function latestInsights() {
  const [latest] = await insightsStore().find({}, { sort: { createdAt: -1 }, limit: 1 });
  return latest || null;
}

export async function refreshInsights({ days = 30, user } = {}) {
  const data = await growthData({ days });
  const result = await generateInsights(forAi(data));
  return insightsStore().insert({
    ...result,
    days,
    simulated: data.social?.simulated || false,
    websiteConnected: data.website.configured && !data.website.error,
    createdBy: user?.email || null,
  });
}
