/**
 * Buffer GraphQL API (https://api.buffer.com/graphql).
 *
 * Auth is a personal API key from Buffer → Settings → API, sent as a Bearer
 * token. Query shapes follow Buffer's official CLI (@bufferapp/cli 2.x).
 * Post metrics are marked experimental by Buffer and refresh about once a day.
 */

const ENDPOINT = "https://api.buffer.com/graphql";
const ERROR_TYPES = [
  "InvalidInputError",
  "LimitReachedError",
  "NotFoundError",
  "RestProxyError",
  "UnauthorizedError",
  "UnexpectedError",
];
const ERROR_FRAGMENTS = ERROR_TYPES.map((t) => `... on ${t} { message }`).join(" ");

export class BufferError extends Error {
  constructor(message, { status, retryAfter } = {}) {
    super(message);
    this.name = "BufferError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function bufferApiKey() {
  // BUFFER_API_TOKEN is accepted for older setups that used that name.
  return process.env.BUFFER_API_KEY || process.env.BUFFER_API_TOKEN || "";
}

async function gql(query, variables = {}) {
  const key = bufferApiKey();
  if (!key) throw new BufferError("BUFFER_API_KEY is not set");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "x-buffer-client-name": "photo-content-engine",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after")) || null;
    throw new BufferError(
      `Buffer rate limit reached${retryAfter ? `, try again in ${Math.ceil(retryAfter / 60)} min` : ""}.`,
      { status: 429, retryAfter }
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new BufferError("Buffer rejected the API key. Check BUFFER_API_KEY.", { status: res.status });
  }

  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    throw new BufferError(`Buffer API error (${res.status})`, { status: res.status });
  }
  if (body.errors?.length) {
    throw new BufferError(body.errors.map((e) => e.message).join("; "), { status: res.status });
  }
  return body.data;
}

function unwrapMutation(result, field) {
  if (!result) throw new BufferError(`Buffer returned no ${field} result`);
  if (result.__typename === "PostActionSuccess" || result.__typename === "DeletePostSuccess") {
    return result;
  }
  throw new BufferError(result.message || `Buffer ${field} failed (${result.__typename})`);
}

const POST_FIELDS = `
  id text status dueAt sentAt createdAt channelId channelService externalLink
  error { message }
  assets { source thumbnail type }
  channel { id name displayName avatar service }
`;

function normalisePost(node) {
  return {
    id: node.id,
    text: node.text || "",
    status: node.status,
    dueAt: node.dueAt,
    sentAt: node.sentAt,
    createdAt: node.createdAt,
    channelId: node.channelId || node.channel?.id,
    service: (node.channelService || node.channel?.service || "").toLowerCase(),
    channelName: node.channel?.displayName || node.channel?.name || "",
    avatar: node.channel?.avatar || null,
    externalLink: node.externalLink || null,
    error: node.error?.message || null,
    images: (node.assets || []).filter((a) => a.type !== "video").map((a) => a.source || a.thumbnail),
    metrics: node.metrics || null,
    metricsUpdatedAt: node.metricsUpdatedAt || null,
  };
}

export async function getAccount() {
  const data = await gql(`query Account { account { id email name timezone organizations { id name } } }`);
  return data.account;
}

/**
 * Organisations to read. BUFFER_ORGANIZATION_ID pins one; otherwise every
 * organisation on the account — channels can live in any of them.
 */
export async function listOrganizations() {
  if (process.env.BUFFER_ORGANIZATION_ID) return [{ id: process.env.BUFFER_ORGANIZATION_ID, name: null }];
  const account = await getAccount();
  if (!account.organizations?.length) throw new BufferError("This Buffer account has no organization.");
  return account.organizations;
}

export async function resolveOrganizationId() {
  return (await listOrganizations())[0].id;
}

export async function listChannels() {
  const orgs = await listOrganizations();
  const perOrg = await Promise.all(
    orgs.map(async (org) => {
      const data = await gql(
        `query Channels($input: ChannelsInput!) {
          channels(input: $input) {
            id name displayName service avatar timezone isQueuePaused isDisconnected isLocked
          }
        }`,
        { input: { organizationId: org.id } }
      );
      return data.channels.map((c) => ({
        id: c.id,
        name: c.displayName || c.name,
        service: (c.service || "").toLowerCase(),
        avatar: c.avatar,
        timezone: c.timezone,
        paused: Boolean(c.isQueuePaused),
        disconnected: Boolean(c.isDisconnected || c.isLocked),
        organizationId: org.id,
        organizationName: org.name,
      }));
    })
  );
  return perOrg.flat();
}

/**
 * Posts in a date window, newest pages first. `statuses` defaults to everything
 * that belongs on a calendar.
 */
export async function listPosts({
  start,
  end,
  statuses = ["scheduled", "sending", "sent", "error", "draft", "needs_approval"],
  channelIds,
  withMetrics = false,
  maxPages = 5,
} = {}) {
  const orgs = await listOrganizations();
  const metrics = withMetrics ? "metrics { type name value unit } metricsUpdatedAt" : "";
  const query = `query Posts($first: Int, $after: String, $input: PostsInput!) {
    posts(first: $first, after: $after, input: $input) {
      edges { node { ${POST_FIELDS} ${metrics} } }
      pageInfo { hasNextPage endCursor }
    }
  }`;

  const filter = { status: statuses };
  if (start || end) filter.dueAt = { ...(start && { start }), ...(end && { end }) };
  if (channelIds?.length) filter.channelIds = channelIds;

  const perOrg = await Promise.all(
    orgs.map(async ({ id: organizationId }) => {
      const posts = [];
      let after = null;
      for (let page = 0; page < maxPages; page++) {
        const data = await gql(query, {
          first: 100,
          after,
          input: { organizationId, filter, sort: [{ field: "dueAt", direction: "asc" }] },
        });
        posts.push(...data.posts.edges.map((e) => normalisePost(e.node)));
        if (!data.posts.pageInfo.hasNextPage) break;
        after = data.posts.pageInfo.endCursor;
      }
      return posts;
    })
  );
  return perOrg.flat().sort((a, b) => String(a.dueAt || a.sentAt).localeCompare(String(b.dueAt || b.sentAt)));
}

export async function getPost(id) {
  const data = await gql(
    `query Post($input: PostInput!) { post(input: $input) { ${POST_FIELDS} metrics { type name value unit } metricsUpdatedAt } }`,
    { input: { id } }
  );
  return data.post ? normalisePost(data.post) : null;
}

/** Shapes our post request into Buffer's CreatePostInput / EditPostInput. */
export function toBufferInput({ service, text, images = [], dueAt, firstComment, altText }) {
  const input = {
    text,
    schedulingType: "automatic",
    mode: dueAt ? "customScheduled" : "addToQueue",
    ...(dueAt && { dueAt }),
    source: "photo-content-engine",
    aiAssisted: true,
  };

  if (images.length) {
    input.assets = images.map((img) => ({
      image: {
        url: img.url,
        ...(img.width && img.height && {
          metadata: {
            altText: (img.alt || altText || "").slice(0, 1000),
            dimensions: { width: img.width, height: img.height },
          },
        }),
      },
    }));
  }

  if (service === "instagram") {
    input.metadata = {
      instagram: {
        type: images.length > 1 ? "carousel" : "post",
        shouldShareToFeed: true,
        ...(firstComment && { firstComment }),
      },
    };
  } else if (service === "linkedin" && firstComment) {
    input.metadata = { linkedin: { firstComment } };
  }
  return input;
}

export async function createPost({ channelId, ...post }) {
  const data = await gql(
    `mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        __typename
        ... on PostActionSuccess { post { ${POST_FIELDS} } }
        ${ERROR_FRAGMENTS}
      }
    }`,
    { input: { channelId, ...toBufferInput(post) } }
  );
  return normalisePost(unwrapMutation(data.createPost, "createPost").post);
}

export async function editPost(id, { text, dueAt }) {
  const input = { id };
  if (text !== undefined) input.text = text;
  if (dueAt) {
    input.dueAt = dueAt;
    input.mode = "customScheduled";
    input.schedulingType = "automatic";
  }
  const data = await gql(
    `mutation EditPost($input: EditPostInput!) {
      editPost(input: $input) {
        __typename
        ... on PostActionSuccess { post { ${POST_FIELDS} } }
        ${ERROR_FRAGMENTS}
      }
    }`,
    { input }
  );
  return normalisePost(unwrapMutation(data.editPost, "editPost").post);
}

export async function deletePost(id) {
  const data = await gql(
    `mutation DeletePost($input: DeletePostInput!) {
      deletePost(input: $input) {
        __typename
        ... on DeletePostSuccess { id }
        ... on VoidMutationError { message }
      }
    }`,
    { input: { id } }
  );
  unwrapMutation(data.deletePost, "deletePost");
  return true;
}

/** Roll-up metrics for a window. Buffer only returns metrics every channel supports. */
export async function aggregatedMetrics({ start, end, channelIds }) {
  const organizationId = await resolveOrganizationId();
  const data = await gql(
    `query AggregatedPostMetrics($input: AggregatedPostMetricsInput!) {
      aggregatedPostMetrics(input: $input) { metrics { type name value unit } metricsUpdatedAt }
    }`,
    {
      input: {
        organizationId,
        startDateTime: start,
        endDateTime: end,
        ...(channelIds?.length && { channelIds }),
      },
    }
  );
  return data.aggregatedPostMetrics;
}
