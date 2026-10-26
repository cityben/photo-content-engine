import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getJob } from "@/lib/jobs";
import { modelCatalog } from "@/lib/models";
import { getPost, listChannels, postingEnabled, socialMode } from "@/lib/social";
import { websiteConfigured } from "@/lib/website-api";

import { JobEditor } from "./job-editor";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

  const [channels, catalog, posts] = await Promise.all([
    listChannels().catch(() => []),
    modelCatalog(),
    Promise.all(
      (job.posts || []).map((p) =>
        getPost(p.postId)
          .then((post) => post || { id: p.postId, service: p.service, status: "deleted", text: "Deleted in Buffer", dueAt: p.dueAt, images: [] })
          .catch(() => ({ id: p.postId, service: p.service, status: "scheduled", text: "(couldn't load from Buffer)", dueAt: p.dueAt, images: [] }))
      )
    ),
  ]);

  return (
    <>
      <Link href="/jobs" className="flex w-fit items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="size-4" /> Jobs
      </Link>
      <JobEditor
        initialJob={job}
        posts={posts.filter((p) => p.status !== "deleted")}
        social={{ mode: socialMode(), postingEnabled: postingEnabled(), channels }}
        websiteConnected={websiteConfigured()}
        models={{ active: catalog.active, shortlist: catalog.shortlist }}
      />
    </>
  );
}
