"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Star } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/client-api";
import { formatNumber } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

const selectClass = "h-9 w-full rounded-md border border-input bg-white shadow-field px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring";

export function LeadSearchForm({ areas, categories }) {
  const router = useRouter();
  const [areaId, setAreaId] = useState(areas[0].id);
  const [radiusKm, setRadius] = useState(10);
  const [picked, setPicked] = useState(["property_management_company", "commercial_real_estate_agency"]);
  const [custom, setCustom] = useState("");
  const [keyword, setKeyword] = useState("");
  const [minReviews, setMinReviews] = useState(5);
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const allCategories = [...picked, ...custom.split(",").map((s) => s.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean)].slice(0, 10);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await api("/api/leads/search", { method: "POST", body: { areaId, radiusKm: Number(radiusKm), categories: allCategories, keyword: keyword || undefined, minReviews: Number(minReviews) || 0 } });
          toast.success(`${r.rows} businesses found · cost $${(r.cost || 0).toFixed(3)}`);
          router.refresh();
        } catch (err) {
          toast.error(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ls-area">Area</Label>
          <select id="ls-area" value={areaId} onChange={(e) => setAreaId(e.target.value)} className={selectClass}>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ls-radius">Radius (km)</Label>
          <Input id="ls-radius" type="number" min={1} max={100} value={radiusKm} onChange={(e) => setRadius(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ls-keyword">Description contains (optional)</Label>
          <Input id="ls-keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. office" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ls-min">Min Google reviews</Label>
          <Input id="ls-min" type="number" min={0} value={minReviews} onChange={(e) => setMinReviews(e.target.value)} />
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-gray-900">Who buys from you</legend>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={picked.includes(c.id)}
              onClick={() => toggle(c.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                picked.includes(c.id) ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Input aria-label="Other Google categories, comma-separated" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Other Google categories, comma-separated, e.g. data_center, warehouse" className="max-w-xl" />
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Search />} {busy ? "Searching…" : "Find businesses"}
        </Button>
        <p className="text-xs text-gray-500">Google Maps listings via DataForSEO, up to 100 per search (a few cents).</p>
      </div>
    </form>
  );
}

export function SearchResults({ rows, inPipeline }) {
  const router = useRouter();
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const fresh = rows.filter((r) => r.cid && !inPipeline.includes(r.cid));
  const toggle = (cid) => setSelected((s) => (s.includes(cid) ? s.filter((x) => x !== cid) : [...s, cid]));
  const add = async (cids) => {
    setBusy(true);
    try {
      const r = await api("/api/leads", { method: "POST", body: { cids } });
      toast.success(`${r.added} added to leads${r.skipped ? ` · ${r.skipped} already there` : ""}.`);
      setSelected([]);
      router.refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy || !selected.length} onClick={() => add(selected)}>
          <Plus /> Add {selected.length || ""} selected
        </Button>
        <Button size="sm" variant="outline" disabled={busy || !fresh.length} onClick={() => add(fresh.filter((r) => r.fit >= 60).map((r) => r.cid))}>
          Add all with fit ≥ 60
        </Button>
        <span className="text-xs text-gray-500">Fit weighs buyer type, size (reviews) and whether they have a website.</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <span className="sr-only">Select</span>
            </TableHead>
            <TableHead>Business</TableHead>
            <TableHead className="text-right">Fit</TableHead>
            <TableHead className="text-right">Reviews</TableHead>
            <TableHead className="hidden md:table-cell">Category</TableHead>
            <TableHead className="hidden lg:table-cell">Area</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const added = inPipeline.includes(r.cid);
            return (
              <TableRow key={r.cid || r.name}>
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.name}`}
                    disabled={added || !r.cid}
                    checked={added || selected.includes(r.cid)}
                    onChange={() => toggle(r.cid)}
                    className="size-4 accent-[#003157]"
                  />
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-1.5 font-medium text-gray-900">
                    {r.name} {added && <Badge variant="success">In leads</Badge>}
                  </span>
                  {r.website && (
                    <a href={r.website} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      {r.domain}
                    </a>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn("inline-block min-w-8 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums", r.fit >= 60 ? "bg-marker-soft text-primary" : "bg-gray-100 text-gray-700")}>{r.fit}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    {r.rating != null && <Star className="size-3 fill-amber-400 text-amber-500" aria-hidden />}
                    {r.rating != null ? `${r.rating.toFixed(1)} · ` : ""}
                    {formatNumber(r.reviews)}
                  </span>
                </TableCell>
                <TableCell className="hidden text-xs md:table-cell">{r.category || "—"}</TableCell>
                <TableCell className="hidden text-xs lg:table-cell">{r.city || r.address || "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function ManualLeadForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", website: "", phone: "", category: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await api("/api/leads", { method: "POST", body: { manual: { name: form.name, website: form.website ? (form.website.startsWith("http") ? form.website : `https://${form.website}`) : "", phone: form.phone, category: form.category } } });
          if (r.added) {
            toast.success("Lead added.");
            setForm({ name: "", website: "", phone: "", category: "" });
            router.refresh();
          } else toast.info("Already in your leads.");
        } catch (err) {
          toast.error(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Input aria-label="Business name" placeholder="Business name" value={form.name} onChange={set("name")} />
      <Input aria-label="Website" placeholder="Website (optional)" value={form.website} onChange={set("website")} />
      <Button type="submit" variant="outline" disabled={busy || form.name.trim().length < 2}>
        <Plus /> Add lead
      </Button>
    </form>
  );
}
