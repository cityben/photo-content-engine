"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/client-api";
import { money } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";


function Score({ value }) {
  return (
    <div className="flex items-center gap-2" aria-label={`${value} out of 10`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value * 10}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-700">{value}/10</span>
    </div>
  );
}

export function ModelPicker({ catalog }) {
  const router = useRouter();
  const [saving, setSaving] = useState(null);
  const [other, setOther] = useState("");

  const choose = async (model) => {
    setSaving(model);
    try {
      await api("/api/settings/model", { method: "PUT", body: { model } });
      toast.success(`New jobs will be written by ${model}.`);
      router.refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(null);
    }
  };

  const otherModel = catalog.others.find((m) => m.id === other);

  return (
    <div className="flex flex-col gap-4">
      {catalog.error && (
        <p className="flex items-start gap-2 rounded-md bg-gray-50 p-3 text-xs text-gray-600">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Live prices unavailable ({catalog.error.split(/[.:]/)[0]}). They load once the AI Gateway is reachable — on Vercel this works automatically.
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Model</TableHead>
            <TableHead>Writing score</TableHead>
            <TableHead className="text-right">Per 1M tokens in / out</TableHead>
            <TableHead className="text-right">≈ per job</TableHead>
            <TableHead className="hidden xl:table-cell">Why</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {catalog.shortlist.map((m) => {
            const active = catalog.active === m.id;
            return (
              <TableRow key={m.id} className={cn(active && "bg-primary-soft/60 hover:bg-primary-soft/60")}>
                <TableCell className="align-top">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-gray-900">{m.name}</span>
                    <span className="font-mono text-[11px] text-gray-500">{m.id}</span>
                    <span className="flex flex-wrap gap-1">
                      <Badge variant={m.tier === "Premium" ? "secondary" : m.tier === "Budget" ? "secondary" : "default"}>{m.tier}</Badge>
                      {catalog.bestValue === m.id && <Badge variant="success">Best value for money</Badge>}
                      {m.available === false && <Badge variant="destructive">Not on gateway</Badge>}
                    </span>
                    <span className="text-xs leading-5 text-gray-600 xl:hidden">{m.why}</span>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <Score value={m.score} />
                </TableCell>
                <TableCell className="text-right align-top text-xs tabular-nums whitespace-nowrap">
                  {money(m.inputPerM)} / {money(m.outputPerM)}
                </TableCell>
                <TableCell className="text-right align-top font-medium tabular-nums">{money(m.perJob)}</TableCell>
                <TableCell className="hidden max-w-sm align-top text-xs leading-5 xl:table-cell">{m.why}</TableCell>
                <TableCell className="text-right align-top">
                  {active ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <Check className="size-3.5" /> In use
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => choose(m.id)} disabled={saving !== null || m.available === false}>
                      {saving === m.id ? <Loader2 className="animate-spin" /> : null} Use
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {catalog.others.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="other-model" className="text-sm font-medium text-gray-700">
              Any other gateway model
            </label>
            <Select value={other} onValueChange={setOther}>
              <SelectTrigger id="other-model" className="bg-white">
                <SelectValue placeholder={`${catalog.others.length} more models…`} />
              </SelectTrigger>
              <SelectContent>
                {catalog.others.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id} · {money(m.inputPerM)}/{money(m.outputPerM)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Unrated. It must accept images to read job photos{otherModel?.description ? ` — ${otherModel.description.slice(0, 140)}` : ""}.
            </p>
          </div>
          <Button variant="outline" disabled={!other || saving !== null} onClick={() => choose(other)}>
            Use this model
          </Button>
        </div>
      )}

      <p className="text-xs leading-5 text-gray-500">
        Prices are live from the Vercel AI Gateway. &quot;Per job&quot; = one full write (photos + write-up → every section),{" "}
        {catalog.usage.measured
          ? `averaged from your last ${catalog.usage.runs} runs (${catalog.usage.inputTokens.toLocaleString()} in / ${catalog.usage.outputTokens.toLocaleString()} out tokens).`
          : `estimated at ${catalog.usage.inputTokens.toLocaleString()} in / ${catalog.usage.outputTokens.toLocaleString()} out tokens until you've run a few jobs.`}{" "}
        Scores are our judgement for B2B trade copy that has to rank, not a benchmark — the surest test is Rewrite → pick a model on one of your own jobs and compare.
      </p>
    </div>
  );
}
