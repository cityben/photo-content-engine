import Link from "next/link";

import { cn } from "@/lib/utils";

export function RangePicker({ days, basePath }) {
  return (
    <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Date range">
      {[7, 30, 90].map((d) => (
        <Link
          key={d}
          href={`${basePath}?days=${d}`}
          aria-current={days === d ? "true" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
            days === d ? "bg-white text-gray-900 shadow-paper" : "text-gray-600 hover:text-gray-900"
          )}
        >
          {d} days
        </Link>
      ))}
    </div>
  );
}

export function parseDays(value) {
  const n = Number(value);
  return [7, 30, 90].includes(n) ? n : 30;
}
