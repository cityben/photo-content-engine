"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Mail, PenLine, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { money } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

const selectClass = "h-9 w-full rounded-md border border-input bg-white shadow-field px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring";
const when = (iso) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

function useLead(initial) {
  const [lead, setLead] = useState(initial);
  const [busy, setBusy] = useState(null);
  const run = async (key, fn, success) => {
    setBusy(key);
    try {
      const r = await fn();
      if (r?.lead) setLead(r.lead);
      if (success) toast.success(typeof success === "function" ? success(r) : success);
      return r;
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };
  return { lead, setLead, busy, run };
}

function DraftCard({ lead, draft, run, busy }) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const dirty = subject !== draft.subject || body !== draft.body;
  // Exactly the approved text — placeholders are for the sender to fill in their mail client.
  const fill = (t) => t;
  const mailto = `mailto:${encodeURIComponent(lead.contact?.email || "")}?subject=${encodeURIComponent(fill(draft.subject))}&body=${encodeURIComponent(fill(draft.body))}`;
  const base = `/api/leads/${lead.id}/drafts/${draft.id}`;
  return (
    <li className="flex flex-col gap-3 rounded-lg bg-gray-50 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        {draft.sentAt ? <Badge variant="success">Sent {when(draft.sentAt)}</Badge> : draft.approved ? <Badge variant="success">Approved by {draft.approved.by}</Badge> : <Badge variant="secondary">Needs approval</Badge>}
        <span>{draft.model ? `${draft.model}${draft.costUsd != null ? ` · ${money(draft.costUsd, 3)}` : ""}` : "Written by hand"}</span>
        <span>· {when(draft.createdAt)}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`s-${draft.id}`}>Subject</Label>
        <Input id={`s-${draft.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={Boolean(draft.sentAt)} className="bg-white" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`b-${draft.id}`}>Email</Label>
        <Textarea id={`b-${draft.id}`} rows={9} value={body} onChange={(e) => setBody(e.target.value)} disabled={Boolean(draft.sentAt)} className="bg-white leading-6" />
        <p className="text-xs text-gray-500">{body.trim().split(/\s+/).filter(Boolean).length} words. Replace {"{{sender_name}}"} and any {"{{case_study_url}}"} before sending.</p>
      </div>
      {!draft.sentAt && (
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <Button size="sm" onClick={() => run(`save-${draft.id}`, () => api(base, { method: "PATCH", body: { subject, body } }), "Saved — approve it again before sending.")} disabled={busy}>
              {busy === `save-${draft.id}` && <Loader2 className="animate-spin" />} Save changes
            </Button>
          ) : draft.approved ? (
            <>
              <Button size="sm" variant="outline" asChild>
                <a href={mailto}>
                  <Mail /> Open in email
                </a>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(`Subject: ${fill(draft.subject)}\n\n${fill(draft.body)}`);
                  toast.success("Copied.");
                }}
              >
                <Copy /> Copy
              </Button>
              <Button size="sm" onClick={() => run(`sent-${draft.id}`, () => api(`${base}/sent`, { method: "POST" }), (r) => `Logged as sent. Follow-up set for ${r?.lead?.nextFollowUp}.`)} disabled={busy}>
                {busy === `sent-${draft.id}` ? <Loader2 className="animate-spin" /> : <Send />} Mark as sent
              </Button>
              <Button size="sm" variant="ghost" onClick={() => run(`ap-${draft.id}`, () => api(base, { method: "PATCH", body: { approved: false } }))} disabled={busy}>
                Unapprove
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => run(`ap-${draft.id}`, () => api(base, { method: "PATCH", body: { approved: true } }), "Approved.")} disabled={busy}>
              {busy === `ap-${draft.id}` ? <Loader2 className="animate-spin" /> : <Check />} Approve
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

export function LeadDetail({ initialLead, stages, aiReady }) {
  const router = useRouter();
  const { lead, busy, run } = useLead(initialLead);
  const [contact, setContact] = useState(lead.contact || { name: "", role: "", email: "" });
  const [note, setNote] = useState("");
  const [instructions, setInstructions] = useState("");
  const [manual, setManual] = useState(false);
  const sent = (lead.drafts || []).some((d) => d.sentAt);
  const patch = (body, msg) => run("patch", () => api(`/api/leads/${lead.id}`, { method: "PATCH", body }), msg);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Outreach</CardTitle>
            <CardDescription>Drafts are written from this business&apos;s details and your real jobs. Approve one, send it from your own inbox, then mark it sent — the follow-up date sets itself.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
              <Label htmlFor="instructions" className="text-xs">
                Steer the draft (optional)
              </Label>
              <Input id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. mention our F-Gas maintenance contracts; they manage 3 office blocks" className="bg-white" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => run("ai", () => api(`/api/leads/${lead.id}/drafts`, { method: "POST", body: { kind: sent ? "follow-up" : "intro", instructions: instructions || undefined } }), "Draft ready — read it, edit, approve.")} disabled={Boolean(busy) || !aiReady} title={aiReady ? undefined : "Connect the AI Gateway first — or write your own"}>
                  {busy === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles />} {sent ? "Write follow-up" : "Write intro email"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setManual((m) => !m)}>
                  <PenLine /> Write my own
                </Button>
              </div>
              {manual && (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const r = await run("manual", () => api(`/api/leads/${lead.id}/drafts`, { method: "POST", body: { manual: { subject: f.get("subject"), body: f.get("body") } } }), "Draft saved.");
                    if (r) setManual(false);
                  }}
                >
                  <Input name="subject" aria-label="Subject" placeholder="Subject" required className="bg-white" />
                  <Textarea name="body" aria-label="Email" rows={6} placeholder="Email" required className="bg-white" />
                  <Button type="submit" size="sm" className="w-fit" disabled={Boolean(busy)}>
                    Save draft
                  </Button>
                </form>
              )}
            </div>
            {lead.drafts?.length ? (
              <ul className="flex flex-col gap-3">
                {lead.drafts.map((d) => (
                  <DraftCard key={`${d.id}-${d.subject}-${d.body.length}-${Boolean(d.approved)}-${d.sentAt}`} lead={lead} draft={d} run={run} busy={busy} />
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-600">No drafts yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await patch({ note }, "Logged.");
                if (r) setNote("");
              }}
            >
              <Input aria-label="Log a call or note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log a call or note, e.g. Spoke to FM, retender in March" />
              <Button type="submit" variant="outline" disabled={!note.trim() || Boolean(busy)}>
                Log
              </Button>
            </form>
            <ol className="flex flex-col gap-2">
              {[...(lead.activity || [])].reverse().map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className="w-28 shrink-0 text-xs tabular-nums text-gray-500">{when(a.at)}</span>
                  <span className={cn("min-w-0 text-gray-700", a.type === "note" && "text-gray-900")}>
                    {a.text}
                    {a.by && <span className="text-xs text-gray-500"> · {a.by}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Stage</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Label htmlFor="lead-stage" className="sr-only">
              Stage
            </Label>
            <select id="lead-stage" value={lead.status} onChange={(e) => patch({ status: e.target.value }, "Stage updated.")} className={selectClass} disabled={Boolean(busy)}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lead-follow">Next follow-up</Label>
              <Input id="lead-follow" type="date" value={lead.nextFollowUp || ""} onChange={(e) => patch({ nextFollowUp: e.target.value || null }, "Follow-up set.")} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
            <CardDescription>The person to write to, if you know them.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                patch({ contact }, "Contact saved.");
              }}
            >
              {[
                ["name", "Name"],
                ["role", "Role"],
                ["email", "Email"],
              ].map(([k, label]) => (
                <div key={k} className="flex flex-col gap-1">
                  <Label htmlFor={`c-${k}`} className="text-xs">
                    {label}
                  </Label>
                  <Input id={`c-${k}`} type={k === "email" ? "email" : "text"} value={contact[k] || ""} onChange={(e) => setContact((c) => ({ ...c, [k]: e.target.value }))} />
                </div>
              ))}
              <Button type="submit" size="sm" variant="outline" className="w-fit" disabled={Boolean(busy)}>
                Save contact
              </Button>
            </form>
          </CardContent>
        </Card>
        <Button
          variant="ghost"
          className="w-fit text-destructive"
          onClick={async () => {
            if (!window.confirm(`Delete ${lead.name} and its history?`)) return;
            const r = await run("delete", () => api(`/api/leads/${lead.id}`, { method: "DELETE" }), "Lead deleted.");
            if (r) router.push("/leads");
          }}
        >
          <Trash2 /> Delete lead
        </Button>
      </div>
    </div>
  );
}
