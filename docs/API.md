# API Documentation — Photo Content Engine

## Overview

The Photo Content Engine provides a RESTful API for transforming job site photos into multi-platform marketing content.

## Base URL

```
http://localhost:3000/api          (Development)
https://photo-engine.vercel.app/api (Production)
```

## Authentication

All requests require a Bearer token:

```bash
Authorization: Bearer YOUR_API_KEY
```

API keys are managed by the Acme Ltd admin.

---

## POST /generate-content

Uploads a photo and generates marketing content for 7 platforms.

### Request

```bash
curl -X POST http://localhost:3000/api/generate-content \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "metadata": {
      "job_title": "Commercial HVAC Installation",
      "sector": "Commercial",
      "location": "Bristol, UK",
      "company": "Acme Air Conditioning"
    }
  }'
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `imageData` | string | Yes | Base64-encoded image or public image URL |
| `metadata.job_title` | string | No | Name of the project (e.g., "HVAC Installation") |
| `metadata.sector` | string | No | Business sector (e.g., "Commercial", "Industrial", "Healthcare") |
| `metadata.location` | string | No | Project location (e.g., "Bristol, UK") |
| `metadata.company` | string | No | Division company (auto-detected from sector if not provided) |

### Response

```json
{
  "success": true,
  "image_analysis": {
    "equipment": ["HVAC unit", "Copper piping", "Thermostat"],
    "work_type": "installation",
    "scope": "Commercial building HVAC system installation",
    "sector": "Commercial",
    "technical_details": "...",
    "quality_assessment": "Professional installation with high quality finish"
  },
  "content": {
    "linkedin": {
      "post": "We've just completed a comprehensive HVAC installation...",
      "hashtags": ["#HVAC", "#MEEngineering", "#Commercial"],
      "word_count": 185,
      "cta": "View case study"
    },
    "instagram": {
      "caption": "New project alert! 🔧 We just installed a commercial...",
      "emojis": 7,
      "hashtags": ["#HVAC", "#acme"],
      "cta": "Link in bio for details",
      "word_count": 120
    },
    "before_after": {
      "description": "Our team tackled a major HVAC overhaul...",
      "word_count": 165,
      "benefits": ["Energy efficiency", "Cost savings", "Reliability"]
    },
    "gmb": {
      "post": "Just completed a commercial HVAC installation...",
      "hashtags": ["#HVAC"],
      "cta": "Schedule your service",
      "word_count": 85
    },
    "blog": {
      "title": "Commercial HVAC Installation: Best Practices in Bristol",
      "meta_description": "Learn how our team installed a commercial HVAC system...",
      "sections": [
        {
          "heading": "The Challenge",
          "description": "Large commercial building needed..."
        }
      ],
      "keywords": ["commercial HVAC Bristol", "HVAC installation"],
      "estimated_read_time": "4 min",
      "seo_notes": "Target local searches with location keywords"
    },
    "schema": {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Acme Ltd",
      "service": {...}
    },
    "twitter": {
      "thread": [
        {
          "tweet": 1,
          "text": "🔧 Just completed a commercial HVAC installation for a Bristol facility manager..."
        }
      ],
      "hashtags": ["#HVAC", "#Commercial"],
      "thread_count": 3
    },
    "keywords": {
      "primary_keywords": ["commercial HVAC Bristol", "HVAC installation"],
      "secondary_keywords": ["HVAC system repair", "commercial cooling"],
      "location_keywords": ["HVAC Bristol", "heating contractor Bristol"],
      "difficulty": "Medium",
      "search_volume_estimate": 480,
      "recommended_focus": "Target 'commercial HVAC' + location keywords"
    }
  },
  "website_draft": {
    "project_id": "507f1f77bcf86cd799439011",
    "slug": "commercial-hvac-bristol-2026",
    "url": "https://acme.co.uk/case-studies/commercial-hvac-bristol-2026",
    "status": "draft"
  },
  "timestamp": "2026-10-26T15:30:00Z",
  "next_step": "Review content and export or post to Buffer"
}
```

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (missing/invalid data) |
| 401 | Unauthorized (invalid API key) |
| 500 | Server error |

---

## POST /posts/to-buffer

Posts generated content to Buffer for scheduling.

### Request

```bash
curl -X POST http://localhost:3000/api/posts/to-buffer \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "linkedin",
    "content": "We just completed...",
    "imageUrl": "https://...",
    "scheduledTime": "2026-10-27T09:00:00Z"
  }'
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `platform` | string | Yes | `linkedin`, `instagram`, or `twitter` |
| `content` | string | Yes | The post text |
| `imageUrl` | string | No | Image URL to attach |
| `scheduledTime` | string | No | ISO 8601 timestamp to schedule post (optional) |

### Response

```json
{
  "success": true,
  "buffer_id": "507f1f77bcf86cd799439011",
  "status": "draft",
  "buffer_url": "https://buffer.com/app/posts/507f1f77...",
  "scheduled_at": 1697883600
}
```

---

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Missing or invalid authorization header"
}
```

**Fix:** Verify your API key is valid and the Authorization header is set correctly.

### 400 Bad Request

```json
{
  "error": "Missing image data"
}
```

**Fix:** Ensure `imageData` is provided in valid base64 or URL format.

### 500 Server Error

```json
{
  "error": "Failed to generate content",
  "details": "API key rate limited"
}
```

**Fix:** Check server logs or contact support.

---

## Rate Limits

- **Free tier:** 10 requests/hour
- **Pro tier:** 100 requests/hour
- **Enterprise:** Custom limits

Rate limit headers:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1697883600
```

---

## Code Examples

### JavaScript/Node.js

```javascript
const API_KEY = process.env.PHOTO_ENGINE_API_KEY;

async function generateContent(imageUrl, metadata) {
  const response = await fetch('http://localhost:3000/api/generate-content', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageData: imageUrl,
      metadata,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}

// Usage
const content = await generateContent(
  'https://example.com/photo.jpg',
  {
    job_title: 'HVAC Installation',
    sector: 'Commercial',
  }
);

console.log(content.content.linkedin.post);
```

### Python

```python
import requests
import os

API_KEY = os.environ.get('PHOTO_ENGINE_API_KEY')

def generate_content(image_url, metadata):
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json',
    }
    
    payload = {
        'imageData': image_url,
        'metadata': metadata,
    }
    
    response = requests.post(
        'http://localhost:3000/api/generate-content',
        json=payload,
        headers=headers,
    )
    
    response.raise_for_status()
    return response.json()

# Usage
content = generate_content(
    'https://example.com/photo.jpg',
    {'job_title': 'HVAC Installation', 'sector': 'Commercial'},
)

print(content['content']['linkedin']['post'])
```

### cURL

```bash
curl -X POST http://localhost:3000/api/generate-content \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "metadata": {
    "job_title": "HVAC Installation",
    "sector": "Commercial"
  }
}
EOF
```

---

## Webhook Integration (Coming Phase 2)

```bash
POST /api/webhooks/subscribe

{
  "event": "content_generated",
  "webhook_url": "https://yourdomain.com/webhook"
}
```

---

## Support

For API support, email: ben.wilson@example.co.uk
