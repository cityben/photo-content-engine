import { PageHeader } from "@/components/shell/app-shell";
import { getJob } from "@/lib/jobs";

import { SizerClient } from "./sizer-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Social sizer — Content Engine" };

export default async function SizerPage({ searchParams }) {
  const { job: jobId } = await searchParams;
  const found = typeof jobId === "string" && jobId ? await getJob(jobId) : null;
  const job = found ? { id: found.id, title: found.title || "Job", images: (found.images || []).map(({ url }) => ({ url })) } : null;
  return (
    <>
      <PageHeader
        title="Social sizer"
        description="One subject point per photo, cut to every platform size from the original. The bright box shows what survives every cut — keep the important part inside it."
      />
      <SizerClient job={job} aiAvailable={Boolean(process.env.VERCEL || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN)} />
    </>
  );
}
