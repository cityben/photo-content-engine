import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listJobs } from "@/lib/jobs";
import { formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobs — Content Engine" };

function JobStatus({ job }) {
  const written = Boolean(job.content?.linkedin || job.content?.instagram || job.content?.caseStudy);
  return (
    <div className="flex flex-wrap gap-1.5">
      {!written && <Badge variant="secondary">Not written</Badge>}
      {written && !job.posts?.length && <Badge>Ready to schedule</Badge>}
      {job.posts?.length > 0 && <Badge variant="success">{job.posts.length} post{job.posts.length === 1 ? "" : "s"}</Badge>}
      {job.website?.projectId && <Badge variant="success">Case study draft</Badge>}
    </div>
  );
}

export default async function JobsPage() {
  const jobs = await listJobs();
  return (
    <>
      <PageHeader
        title="Jobs"
        description="Every finished job and what's been made from it."
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <Plus /> New job
            </Link>
          </Button>
        }
      />
      {jobs.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl bg-white p-8 shadow-paper">
          <h2 className="text-lg font-semibold text-gray-900">No jobs yet</h2>
          <p className="max-w-prose text-sm text-gray-600">Upload photos from a finished job with a few lines about it. You&apos;ll get LinkedIn and Instagram posts, a website case study and keyword advice to review.</p>
          <Button asChild>
            <Link href="/jobs/new">
              <Plus /> Create your first job
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/jobs/${job.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-paper outline-none transition-shadow hover:shadow-paper-lg focus-visible:ring-[3px] focus-visible:ring-ring"
              >
                <div className="relative aspect-[16/10] bg-gray-100">
                  {job.images?.[0] && <Image src={job.images[0].url} alt="" fill unoptimized sizes="(min-width:1280px) 400px, 50vw" className="object-cover" />}
                  {job.images?.length > 1 && (
                    <span className="absolute right-2 bottom-2 rounded-full bg-white/95 px-2 py-0.5 text-xs text-gray-700 shadow-paper">{job.images.length} photos</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <h2 className="line-clamp-2 font-semibold text-gray-900">{job.title}</h2>
                  <p className="line-clamp-2 text-sm text-gray-600">{job.writeUp || "No write-up"}</p>
                  <div className="mt-auto flex flex-col gap-2 pt-2">
                    <JobStatus job={job} />
                    <span className="text-xs text-gray-500">Added {formatDateTime(job.createdAt, { weekday: undefined })}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
