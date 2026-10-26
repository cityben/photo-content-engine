"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

export function RefreshInsightsButton({ days, hasInsights }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await api("/api/insights", { method: "POST", body: { days } });
      toast.success("Insights updated.");
      router.refresh();
    } catch (e) {
      toast.error(`Couldn't generate insights: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button onClick={run} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {busy ? "Analysing…" : hasInsights ? "Refresh insights" : "Generate insights"}
    </Button>
  );
}
