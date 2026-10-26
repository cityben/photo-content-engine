/**
 * Social sizer geometry: every platform size, and how a photo is cut to each
 * one around a single subject point. Pure (no DOM) — the browser draws with
 * these rectangles and tests check them (tests/sizer.test.js).
 */

/** set: feed | stories | wide — sizes in a set share a shape, so one crop suits them all. */
export const PLATFORMS = [
  {
    id: "linkedin",
    label: "LinkedIn",
    sizes: [
      { id: "li-portrait", label: "Feed portrait", note: "Most feed space", w: 1080, h: 1350, set: "feed" },
      { id: "li-square", label: "Feed square", note: "Safe everywhere", w: 1200, h: 1200, set: "feed" },
      { id: "li-landscape", label: "Feed landscape", note: "Also link previews", w: 1200, h: 627, set: "wide" },
      { id: "li-cover", label: "Page cover", note: "Very wide banner", w: 1128, h: 191, set: "wide" },
    ],
  },
  {
    id: "instagram",
    label: "Instagram",
    sizes: [
      { id: "ig-portrait", label: "Feed portrait", note: "Most feed space", w: 1080, h: 1350, set: "feed" },
      { id: "ig-square", label: "Feed square", note: "Grid-safe", w: 1080, h: 1080, set: "feed" },
      { id: "ig-story", label: "Story / Reel", note: "Full screen", w: 1080, h: 1920, set: "stories" },
      { id: "ig-landscape", label: "Feed landscape", note: "Widest feed crop", w: 1080, h: 566, set: "wide" },
    ],
  },
  {
    id: "facebook",
    label: "Facebook",
    sizes: [
      { id: "fb-portrait", label: "Feed portrait", note: "Most feed space", w: 1080, h: 1350, set: "feed" },
      { id: "fb-landscape", label: "Feed landscape", note: "Also link previews", w: 1200, h: 630, set: "wide" },
      { id: "fb-story", label: "Story", note: "Full screen", w: 1080, h: 1920, set: "stories" },
      { id: "fb-cover", label: "Page cover", note: "Crops hard on mobile", w: 1640, h: 856, set: "wide" },
    ],
  },
  {
    id: "google",
    label: "Google Business",
    sizes: [
      { id: "gb-post", label: "Post", note: "Profile updates", w: 1200, h: 900, set: "feed" },
      { id: "gb-gallery", label: "Gallery photo", note: "Business photos", w: 1200, h: 1200, set: "feed" },
    ],
  },
  {
    id: "x",
    label: "X",
    sizes: [
      { id: "x-post", label: "Post", note: "Timeline card", w: 1600, h: 900, set: "wide" },
      { id: "x-header", label: "Header", note: "Profile banner", w: 1500, h: 500, set: "wide" },
    ],
  },
  { id: "tiktok", label: "TikTok", sizes: [{ id: "tt-video", label: "Video / photo", note: "Full screen", w: 1080, h: 1920, set: "stories" }] },
  { id: "youtube", label: "YouTube", sizes: [{ id: "yt-thumb", label: "Thumbnail", note: "Video cover", w: 1280, h: 720, set: "wide" }] },
  { id: "pinterest", label: "Pinterest", sizes: [{ id: "pin-standard", label: "Standard pin", note: "Tall 2:3 pin", w: 1000, h: 1500, set: "stories" }] },
];

export const ALL_SIZES = PLATFORMS.flatMap((p) => p.sizes.map((s) => ({ ...s, platform: p.id, platformLabel: p.label })));

export const SETS = {
  feed: { label: "Feed" },
  stories: { label: "Stories" },
  wide: { label: "Wide & banners" },
};

/** What a fresh session starts with: the feed sizes for the main channels. */
export const DEFAULT_SIZES = ["li-portrait", "li-square", "ig-portrait", "ig-square", "ig-story", "fb-portrait", "gb-post"];

export function sizesInSet(set) {
  return set === "all" ? ALL_SIZES.map((s) => s.id) : ALL_SIZES.filter((s) => s.set === set).map((s) => s.id);
}

/** "4:5", "1.91:1" — the familiar way platforms write shapes. */
export function ratioLabel(w, h) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const g = gcd(w, h);
  const [a, b] = [w / g, h / g];
  if (a <= 20 && b <= 20) return `${a}:${b}`;
  return w >= h ? `${(w / h).toFixed(2)}:1` : `1:${(h / w).toFixed(2)}`;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Source rectangle for a "crop" (cover) cut: the largest area of the target's
 * shape, shrunk by `zoom`, centred on the subject point (fx, fy in 0–1) plus a
 * pan (dx, dy in source pixels), kept inside the photo.
 */
export function cropRect(W, H, tw, th, { fx = 0.5, fy = 0.5, zoom = 1, dx = 0, dy = 0 } = {}) {
  const target = tw / th;
  let sw = W / H > target ? H * target : W;
  let sh = sw / target;
  sw /= Math.max(1, zoom);
  sh /= Math.max(1, zoom);
  const cx = fx * W + dx;
  const cy = fy * H + dy;
  const sx = clamp(cx - sw / 2, 0, W - sw);
  const sy = clamp(cy - sh / 2, 0, H - sh);
  return { sx, sy, sw, sh };
}

/** Destination rectangle for "fit whole photo": the photo letterboxed inside the target. */
export function fitRect(W, H, tw, th) {
  const scale = Math.min(tw / W, th / H);
  const dw = W * scale;
  const dh = H * scale;
  return { dx: (tw - dw) / 2, dy: (th - dh) / 2, dw, dh };
}

/** How much of the photo a cut keeps (0–1) — low means the size crops hard. */
export function keptShare(W, H, rect) {
  return (rect.sw * rect.sh) / (W * H);
}

/**
 * The part of the photo that survives every chosen crop: the intersection of
 * their source rectangles. null if they don't overlap (pan/zoom pulled them apart).
 */
export function safeArea(rects) {
  if (!rects.length) return null;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let x2 = Infinity;
  let y2 = Infinity;
  for (const r of rects) {
    x1 = Math.max(x1, r.sx);
    y1 = Math.max(y1, r.sy);
    x2 = Math.min(x2, r.sx + r.sw);
    y2 = Math.min(y2, r.sy + r.sh);
  }
  return x2 > x1 && y2 > y1 ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } : null;
}

/** Whether the subject point is inside a cut (it should always be, unless panned out). */
export function subjectInside(W, H, rect, fx, fy) {
  const x = fx * W;
  const y = fy * H;
  return x >= rect.sx && x <= rect.sx + rect.sw && y >= rect.sy && y <= rect.sy + rect.sh;
}

/* --- AI extend -------------------------------------------------------------- */

/** Canvas sizes image models accept, closest to the target shape. */
export function extendCanvas(tw, th) {
  const a = tw / th;
  if (a > 1.2) return { w: 1536, h: 1024 };
  if (a < 0.83) return { w: 1024, h: 1536 };
  return { w: 1024, h: 1024 };
}

/**
 * Layout for extending a photo to a new shape: the region of the model canvas
 * with the target's shape, and where the whole photo sits inside it. The
 * model fills the rest; the region is then cut out as the extended frame.
 */
export function extendLayout(W, H, tw, th) {
  const canvas = extendCanvas(tw, th);
  const a = tw / th;
  const rw = canvas.w / canvas.h > a ? canvas.h * a : canvas.w;
  const rh = rw / a;
  const region = { x: (canvas.w - rw) / 2, y: (canvas.h - rh) / 2, w: rw, h: rh };
  const fit = fitRect(W, H, rw, rh);
  return { canvas, region, photo: { x: region.x + fit.dx, y: region.y + fit.dy, w: fit.dw, h: fit.dh } };
}

export function fileName(base, size, format) {
  const ext = format === "image/png" ? "png" : format === "image/webp" ? "webp" : "jpg";
  const safe = String(base).replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "photo";
  return `${safe}-${size.platform}-${size.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${size.w}x${size.h}.${ext}`;
}
