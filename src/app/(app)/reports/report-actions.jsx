"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import { money } from "@/lib/ui-labels";

export function WriteSummaryButton({ month, hasSummary, disabled }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={hasSummary ? "outline" : "default"}
      disabled={busy || disabled}
      title={disabled ? "Connect the AI Gateway first" : undefined}
      onClick={async () => {
        setBusy(true);
        try {
          const { report } = await api("/api/reports/summary", { method: "POST", body: { month } });
          toast.success(`Summary written${report.run?.costUsd != null ? ` · ${money(report.run.costUsd, 3)}` : ""}.`);
          router.refresh();
        } catch (e) {
          toast.error(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} {busy ? "Writing…" : hasSummary ? "Rewrite summary" : "Write summary"}
    </Button>
  );
}

export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()} title="Opens the print dialog — choose “Save as PDF”">
      <Printer /> Download PDF
    </Button>
  );
}

export function CsvMenu({ month, kinds }) {
  return (
    <details className="relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-gray-900 shadow-paper outline-none hover:bg-gray-50 focus-visible:ring-[3px] focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <Download className="size-4" /> CSV
      </summary>
      <ul className="absolute right-0 z-20 mt-1 w-52 rounded-lg bg-white p-1 shadow-paper-lg">
        {Object.entries(kinds).map(([kind, label]) => (
          <li key={kind}>
            <a href={`/api/reports/csv?month=${month}&kind=${kind}`} className="block rounded-md px-3 py-2 text-sm text-gray-800 outline-none hover:bg-gray-100 focus-visible:bg-gray-100">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
