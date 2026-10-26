import { route } from "@/lib/api";
import { getJob, sendBlog } from "@/lib/jobs";

export const maxDuration = 60;

export const POST = route(async ({ params }) => {
  const blogPost = await sendBlog(params.id);
  return { blogPost, job: await getJob(params.id) };
});
