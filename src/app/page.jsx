import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ContentWorkspace } from "@/components/content-workspace";
import { SiteHeader } from "@/components/site-header";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-dvh">
      <SiteHeader user={session.user} />

      <main className="mx-auto flex max-w-[1240px] flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex max-w-[68ch] flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Turn one job photo into seven pieces of content
          </h1>
          <p className="text-base text-gray-600">
            Upload a site photo, add the job details, and get LinkedIn, Instagram, Google Business,
            X, a case study, a blog outline and schema markup — ready to review and send to Buffer.
          </p>
        </div>
        <ContentWorkspace />
      </main>
    </div>
  );
}
