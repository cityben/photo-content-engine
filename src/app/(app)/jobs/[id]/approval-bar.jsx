"use client";

import { useState } from "react";
import { CheckCircle2, CircleDot, Loader2, ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import { hasSubstance, SECTION_LABEL } from "@/lib/content";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Approve / unapprove one section. Approval covers the saved content exactly:
 * with unsaved edits the button saves first, then approves.
 */
export function ApprovalBar({ job, section, data, dirty, onSave, onChanged, aiWritten }) {
  const [busy, setBusy] = useState(false);
  const approval = job.approvals?.[section];
  const ready = hasSubstance(section, data);
  const label = SECTION_LABEL[section];

  const set = async (approved) => {
    setBusy(true);
    try {
      if (approved && dirty) await onSave();
      const { job: updated } = await api(`/api/jobs/${job.id}/approve`, { method: "POST", body: { section, approved } });
      onChanged(updated);
      toast.success(approved ? `${label[0].toUpperCase()}${label.slice(1)} approved.` : "Approval removed.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const approved = approval && !dirty;

  const text = approved
    ? `Approved by ${approval.by || "a team member"} · ${formatDateTime(approval.at)}`
    : dirty
      ? "Unsaved changes — save and approve to use them"
      : !ready
        ? `Not written yet — write the ${label} by hand or with AI`
        : `${aiWritten ? "AI draft" : "Draft"} — read it, change anything, then approve`;

  return (
    <div className={cn("mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2", approved ? "border-primary/15 bg-marker-soft" : "border-border bg-gray-50")}>
      <p className="flex items-center gap-2 text-sm text-gray-700">
        {approved ? <CheckCircle2 className="size-4 shrink-0 text-primary" /> : <CircleDot className="size-4 shrink-0 text-gray-400" />}
        {text}
      </p>
      {approved ? (
        <Button variant="ghost" size="sm" onClick={() => set(false)} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Undo2 />} Unapprove
        </Button>
      ) : (
        <Button size="sm" onClick={() => set(true)} disabled={busy || !ready}>
          {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          {dirty ? "Save and approve" : "Approve"}
        </Button>
      )}
    </div>
  );
}
