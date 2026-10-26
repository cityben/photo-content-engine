import { route } from "@/lib/api";
import { CSV_KINDS, csvFor, isMonth, reportData } from "@/lib/reports";

export const GET = route(async ({ request }) => {
  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const kind = url.searchParams.get("kind");
  if (!isMonth(month)) throw new Error("Use month=YYYY-MM.");
  if (!CSV_KINDS[kind]) throw new Error(`kind must be one of: ${Object.keys(CSV_KINDS).join(", ")}`);
  const csv = csvFor(kind, await reportData(month));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="growth-report-${kind}-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
