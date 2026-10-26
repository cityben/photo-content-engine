import { PageHeader } from "@/components/shell/app-shell";
import { estimateAutopilot, getAutopilot, listAutopilotRuns, rankIdeas } from "@/lib/autopilot";
import { listIdeas } from "@/lib/ideas";
import { reviewQueue } from "@/lib/review";
import { listChannels, postingEnabled, socialMode } from "@/lib/social";
import { websiteConfigured } from "@/lib/website-api";

import { ReviewClient } from "./review-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review — Content Engine" };

export default async function ReviewPage({ searchParams }) {
  const { view } = (await searchParams) || {};
  const [items, channels, config, runs, ideas, website] = await Promise.all([
    reviewQueue(),
    listChannels().catch(() => []),
    getAutopilot(),
    listAutopilotRuns(),
    listIdeas(),
    websiteConfigured(),
  ]);
  const estimate = await estimateAutopilot(config);
  const next = rankIdeas(ideas).map((i) => ({ id: i.id, title: i.title, keyword: i.keyword, score: i.score, volume: i.volume }));
  return (
    <>
      <PageHeader
        title="Review"
        description="Everything written and waiting for you. Approve it, then schedule or send it in one click."
      />
      <ReviewClient
        initialItems={items}
        initialView={["approve", "ready", "all"].includes(view) ? view : "approve"}
        channels={channels.filter((c) => c.canCompose).map((c) => ({ id: c.id, name: c.name, service: c.service, organizationName: c.organizationName || null }))}
        social={{ mode: socialMode(), postingEnabled: postingEnabled() }}
        websiteConnected={website}
        autopilot={{ config, estimate, runs, next, aiReady: Boolean(process.env.VERCEL || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) }}
      />
    </>
  );
}
