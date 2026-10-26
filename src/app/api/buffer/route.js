import {
  createBufferDraft,
  getBufferProfiles,
  getProfileIdForPlatform,
} from "@/lib/buffer";

const PLATFORMS = ["linkedin", "instagram", "twitter"];

function isPostingEnabled() {
  return process.env.ENABLE_BUFFER_POSTING === "true";
}

/**
 * Report whether Buffer is configured, without exposing any secret values.
 */
export async function GET() {
  const configured = Boolean(process.env.BUFFER_API_TOKEN);
  const profiles = Object.fromEntries(
    PLATFORMS.map((p) => [p, Boolean(getProfileIdForPlatform(p))])
  );

  let connected = [];
  if (configured) {
    connected = await getBufferProfiles();
  }

  return Response.json({
    configured,
    posting_enabled: isPostingEnabled(),
    profiles,
    connected_profiles: connected.map(({ service, formatted_username }) => ({
      service,
      formatted_username,
    })),
  });
}

export async function POST(request) {
  if (!isPostingEnabled()) {
    return Response.json(
      { error: "Buffer posting is disabled. Set ENABLE_BUFFER_POSTING=true to enable it." },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const { platform, content, imageUrl, scheduledTime } = body || {};

  if (!PLATFORMS.includes(platform)) {
    return Response.json(
      { error: `platform must be one of: ${PLATFORMS.join(", ")}` },
      { status: 400 }
    );
  }
  if (!content?.trim()) {
    return Response.json({ error: "Missing content" }, { status: 400 });
  }

  const profileId = getProfileIdForPlatform(platform);
  if (!profileId) {
    return Response.json(
      { error: `No Buffer profile configured for ${platform} in BUFFER_PROFILE_IDS` },
      { status: 400 }
    );
  }

  try {
    const result = await createBufferDraft({
      platform,
      text: content,
      mediaUrls: imageUrl ? [imageUrl] : [],
      profileId,
      scheduledTime,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: "Failed to send to Buffer", details: error.message },
      { status: 502 }
    );
  }
}
