import { cn } from "@/lib/utils";

export function StatTile({ label, value, hint, accent, className }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl bg-white p-5 shadow-paper", className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <span className={cn("text-2xl font-bold tabular-nums text-gray-900", accent)}>{value}</span>
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </div>
  );
}
