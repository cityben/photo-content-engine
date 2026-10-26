import { PageHeader } from "@/components/shell/app-shell";
import { FORMATS, getIdea } from "@/lib/ideas";

import { NewJobForm } from "./new-job-form";

export const metadata = { title: "New job — Content Engine" };

export default async function NewJobPage({ searchParams }) {
  const ideaId = (await searchParams)?.idea;
  const found = ideaId ? await getIdea(ideaId).catch(() => null) : null;
  const idea = found && { id: found.id, title: found.title, keyword: found.keyword, volume: found.volume, angle: found.angle, format: FORMATS[found.format] || found.format };
  return (
    <>
      <PageHeader title="New job" description="Photos and a short write-up in; posts, a case study and advice out." />
      <NewJobForm idea={idea || null} />
    </>
  );
}
