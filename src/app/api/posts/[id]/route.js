import { notFound, readJson, route } from "@/lib/api";
import { deletePost, editPost, getPost } from "@/lib/social";
import { postEditSchema } from "@/lib/schemas";

export const GET = route(async ({ params }) => {
  const post = await getPost(params.id);
  if (!post) throw notFound("Post not found");
  return { post };
});

export const PATCH = route(async ({ request, params }) => {
  const input = await readJson(request, postEditSchema);
  return { post: await editPost(params.id, input) };
});

export const DELETE = route(async ({ params }) => {
  await deletePost(params.id);
  return { ok: true };
});
