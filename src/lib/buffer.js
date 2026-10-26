/**
 * Buffer.com API Integration
 *
 * Handles posting content to Buffer for social media scheduling
 */

const BUFFER_API_BASE = 'https://api.bufferapp.com/1';
const BUFFER_TOKEN = process.env.BUFFER_API_TOKEN;

/**
 * Create a draft post in Buffer
 */
export async function createBufferDraft({
  platform,
  text,
  mediaUrls = [],
  profileId,
  scheduledTime = null,
}) {
  if (!BUFFER_TOKEN) {
    throw new Error('BUFFER_API_TOKEN not configured');
  }

  try {
    const payload = {
      profile_ids: [profileId],
      text,
    };

    // Add media if provided
    if (mediaUrls.length > 0) {
      payload.media = {
        link: mediaUrls[0],
        ...(mediaUrls.length > 1 && { media: mediaUrls.map(url => ({ url })) }),
      };
    }

    // Schedule if time provided
    if (scheduledTime) {
      payload.scheduled_at = Math.floor(new Date(scheduledTime).getTime() / 1000);
    }

    const response = await fetch(`${BUFFER_API_BASE}/updates/create.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        access_token: BUFFER_TOKEN,
        ...flattenPayload(payload),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Buffer API error: ${error.message}`);
    }

    const result = await response.json();
    return {
      success: true,
      buffer_id: result.id,
      status: result.status,
      buffer_url: result.buffer_url,
      scheduled_at: result.scheduled_at,
    };
  } catch (error) {
    console.error('[buffer] Failed to create draft:', error);
    throw error;
  }
}

/**
 * Get Buffer profile information
 */
export async function getBufferProfiles() {
  if (!BUFFER_TOKEN) {
    throw new Error('BUFFER_API_TOKEN not configured');
  }

  try {
    const response = await fetch(`${BUFFER_API_BASE}/profiles.json?access_token=${BUFFER_TOKEN}`);

    if (!response.ok) {
      throw new Error(`Buffer API error: ${response.status}`);
    }

    const profiles = await response.json();
    return profiles.map(p => ({
      id: p.id,
      service: p.service,
      formatted_username: p.formatted_username,
      avatar: p.avatar,
    }));
  } catch (error) {
    console.error('[buffer] Failed to fetch profiles:', error);
    return [];
  }
}

/**
 * Get default profile ID for a platform
 */
export function getProfileIdForPlatform(platform, configuredIds = '') {
  const profileIds = (configuredIds || process.env.BUFFER_PROFILE_IDS || '').split(',');

  const platformMap = {
    'linkedin': 0,
    'instagram': 1,
    'twitter': 2,
  };

  const index = platformMap[platform.toLowerCase()];
  return index !== undefined ? profileIds[index]?.trim() : null;
}

/**
 * Flatten nested object for URL params
 */
function flattenPayload(obj, prefix = '') {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}[${key}]` : key;

    if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        result[`${newKey}[${idx}]`] = item;
      });
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenPayload(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Validate Buffer API connectivity
 */
export async function validateBufferAPI() {
  if (!BUFFER_TOKEN) {
    return {
      connected: false,
      error: 'BUFFER_API_TOKEN not configured',
    };
  }

  try {
    const response = await fetch(
      `${BUFFER_API_BASE}/profiles.json?access_token=${BUFFER_TOKEN}`
    );

    if (!response.ok) {
      throw new Error(`Status: ${response.status}`);
    }

    const profiles = await response.json();
    return {
      connected: true,
      profiles_count: profiles.length,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
}
