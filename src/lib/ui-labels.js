/** Display helpers shared by client and server components. */

export const SERVICES = {
  linkedin: { label: "LinkedIn", chip: "bg-sky-50 text-sky-900", dot: "bg-sky-600", limit: 3000 },
  instagram: { label: "Instagram", chip: "bg-rose-50 text-rose-900", dot: "bg-rose-500", limit: 2200 },
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
