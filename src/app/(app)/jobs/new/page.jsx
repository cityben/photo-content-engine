import { PageHeader } from "@/components/shell/app-shell";

import { NewJobForm } from "./new-job-form";

export const metadata = { title: "New job — Content Engine" };

export default function NewJobPage() {
  return (
    <>
      <PageHeader title="New job" description="Photos and a short write-up in; posts, a case study and advice out." />
      <NewJobForm />
    </>
  );
}
