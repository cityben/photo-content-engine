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

  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg p-3 sm:px-4",
        approved ? "bg-marker-soft" : "bg-gray-50"
      )}
    >
      <p className="flex items-start gap-2 text-sm text-gray-800">
        {approved ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-700" />
        ) : (
          <CircleDot className="mt-0.5 size-4 shrink-0 text-gray-500" />
        )}
        <span>
          {approved ? (
            <>
              <span className="font-medium">Approved</span>
              <span className="text-gray-600">
                {" "}
                by {approval.by || "a team member"} · {formatDateTime(approval.at)}
              </span>
            </>
          ) : dirty ? (
            <>
              <span className="font-medium">Unsaved changes</span>
              <span className="text-gray-600"> — save and approve before it can go out.</span>
            </>
          ) : !ready ? (
            <span className="text-gray-600">Write the {label} here — by hand or with AI — then approve it.</span>
          ) : (
            <>
              <span className="font-medium">{aiWritten ? "AI draft — not approved" : "Not approved"}</span>
              <span className="text-gray-600"> — check it, edit anything, then approve. Nothing goes out until you do.</span>
            </>
          )}
        </span>
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
