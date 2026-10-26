/** Display helpers shared by client and server components. */

export const SERVICES = {
  linkedin: { label: "LinkedIn", chip: "bg-sky-50 text-sky-900", dot: "bg-sky-600", limit: 3000 },
  instagram: { label: "Instagram", chip: "bg-rose-50 text-rose-900", dot: "bg-rose-500", limit: 2200 },
  facebook: { label: "Facebook", chip: "bg-blue-50 text-blue-900", dot: "bg-blue-600", limit: 63206 },
  googlebusiness: { label: "Google Business", chip: "bg-emerald-50 text-emerald-900", dot: "bg-emerald-600", limit: 1500 },
  twitter: { label: "X", chip: "bg-gray-100 text-gray-900", dot: "bg-gray-800", limit: 280 },
  threads: { label: "Threads", chip: "bg-gray-100 text-gray-900", dot: "bg-gray-700", limit: 500 },
  tiktok: { label: "TikTok", chip: "bg-fuchsia-50 text-fuchsia-900", dot: "bg-fuchsia-600", limit: 2200 },
  youtube: { label: "YouTube", chip: "bg-red-50 text-red-900", dot: "bg-red-600", limit: 5000 },
  pinterest: { label: "Pinterest", chip: "bg-red-50 text-red-900", dot: "bg-red-500", limit: 500 },
  bluesky: { label: "Bluesky", chip: "bg-sky-50 text-sky-900", dot: "bg-sky-400", limit: 300 },
  mastodon: { label: "Mastodon", chip: "bg-violet-50 text-violet-900", dot: "bg-violet-600", limit: 500 },
  startpage: { label: "Start Page", chip: "bg-gray-100 text-gray-800", dot: "bg-gray-500", limit: 3000 },
};

export function serviceInfo(service) {
  return SERVICES[service] || { label: service || "Channel", chip: "bg-gray-100 text-gray-800", dot: "bg-gray-400", limit: 3000 };
}

export const POST_STATUS = {
  scheduled: { label: "Scheduled", variant: "default" },
  sending: { label: "Sending", variant: "default" },
  sent: { label: "Published", variant: "success" },
  error: { label: "Failed", variant: "destructive" },
  draft: { label: "Draft", variant: "secondary" },
  needs_approval: { label: "Needs approval", variant: "secondary" },
};

export function formatNumber(value, unit) {
  if (value === null || value === undefined) return "—";
  if (unit === "percentage") return `${Number(value).toFixed(1)}%`;
  return new Intl.NumberFormat("en-GB", { notation: value >= 10000 ? "compact" : "standard" }).format(value);
}

/** US dollars (AI Gateway and DataForSEO bill in USD); tiny amounts keep 3 decimals. */
export function money(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value > 0 && value < 0.01) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(digits)}`;
}
