import { ContentWorkspace } from "@/components/content-workspace";

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="bg-white shadow-paper">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-4 sm:px-6">
          <span aria-hidden className="h-6 w-1.5 rounded-full bg-marker" />
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            Acme Ltd
          </span>
          <span className="text-sm text-gray-400">/</span>
          <span className="text-sm text-gray-600">Photo Content Engine</span>
        </div>
      </header>

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
