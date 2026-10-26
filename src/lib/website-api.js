/**
 * Acme Ltd Website API Client
 *
 * Handles integration with the main Acme Ltd website
 * to auto-create case study drafts
 */

const API_BASE = process.env.NEXT_PUBLIC_WEBSITE_API_BASE || 'https://acme.co.uk/api';
const API_TOKEN = process.env.WEBSITE_API_TOKEN;
const API_SECRET = process.env.WEBSITE_API_SECRET;

/**
 * Create a draft project (case study) on the website
 */
export async function createProjectDraft({
  title,
  description,
  sector,
  imageUrl,
  company,
  services = [],
  metadata = {},
}) {
  if (!API_TOKEN) {
    throw new Error('WEBSITE_API_TOKEN not configured');
  }

  try {
    const response = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`,
        'X-API-Secret': API_SECRET || '',
      },
      body: JSON.stringify({
        title,
        slug: generateSlug(title),
        description,
        sector: sector || 'Commercial',
        images: imageUrl ? [imageUrl] : [],
        services: services || [],
        company: company || detectCompany(sector),
        published: false, // Always draft
        publishedAt: null,
        metadata: {
          ...metadata,
          generated_by: 'photo-content-engine',
          generated_at: new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Website API error: ${response.status} ${response.statusText}`);
    }

    const project = await response.json();
    return {
      success: true,
      project_id: project._id,
      slug: project.slug,
      url: `https://acme.co.uk/case-studies/${project.slug}`,
      status: 'draft',
    };
  } catch (error) {
    console.error('[website-api] Failed to create project draft:', error);
    throw error;
  }
}

/**
 * Publish an existing draft project
 */
export async function publishProject(projectId) {
  if (!API_TOKEN) {
    throw new Error('WEBSITE_API_TOKEN not configured');
  }

  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`,
        'X-API-Secret': API_SECRET || '',
      },
      body: JSON.stringify({
        published: true,
        publishedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Website API error: ${response.status}`);
    }

    const project = await response.json();
    return {
      success: true,
      slug: project.slug,
      url: `https://acme.co.uk/case-studies/${project.slug}`,
    };
  } catch (error) {
    console.error('[website-api] Failed to publish project:', error);
    throw error;
  }
}

/**
 * Get published projects for analysis
 */
export async function getPublishedProjects(filters = {}) {
  try {
    const params = new URLSearchParams({
      published: 'true',
      limit: filters.limit || 50,
      ...(filters.sector && { sector: filters.sector }),
      ...(filters.trade && { trade: filters.trade }),
    });

    const response = await fetch(`${API_BASE}/projects?${params}`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Website API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[website-api] Failed to fetch projects:', error);
    return [];
  }
}

/**
 * Generate a URL-friendly slug from title
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Detect company from sector
 */
function detectCompany(sector) {
  const companyMap = {
    'HVAC': 'Acme Air Conditioning',
    'Electrical': 'Acme Electrical',
    'Electrical Group': 'Acme Electrical',
    'Air Conditioning': 'Acme Air Conditioning',
    'Facilities': 'Acme Facilities',
    'Mechanical': 'Acme Mechanical',
  };

  for (const [key, company] of Object.entries(companyMap)) {
    if (sector?.toLowerCase().includes(key.toLowerCase())) {
      return company;
    }
  }

  return 'Acme Ltd'; // Default
}

/**
 * Validate website API connectivity
 */
export async function validateWebsiteAPI() {
  if (!API_TOKEN) {
    return {
      connected: false,
      error: 'WEBSITE_API_TOKEN not configured',
    };
  }

  try {
    const response = await fetch(`${API_BASE}/health`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
      },
    });

    return {
      connected: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
}
