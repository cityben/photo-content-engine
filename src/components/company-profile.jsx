"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";

const FIELDS = [
  ["name", "Company name", "Used in AI writing, outreach and the sidebar"],
  ["regions", "Where you work", "e.g. a city and the counties around it"],
  ["founded", "Trading since", "Year"],
  ["domain", "Website domain", "For search and competitor data, e.g. example.co.uk"],
];

/**
 * Who the content is for, and the website's option lists. Saved in the
 * database so the code carries no company details. Upload the profile file
 * once; edit the basics here any time.
 */
export function CompanyProfileForm({ initial }) {
  const router = useRouter();
  const fileRef = useRef(null);
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setP((x) => ({ ...x, [k]: e.target.value }));

  const save = async (profile, message = "Company profile saved.") => {
    setBusy(true);
    try {
      const { profile: saved } = await api("/api/settings/profile", { method: "PUT", body: { profile } });
      setP(saved);
      toast.success(message);
      router.refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file) => {
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      await save({ ...p, ...json }, "Profile and lists loaded from the file.");
    } catch {
      toast.error("That file isn't a valid profile (JSON).");
    }
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "company-profile.json" });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const services = (p.serviceGroups || []).reduce((n, g) => n + g.services.length, 0);
  const counts = [
    [p.companies?.length || 0, "companies/divisions"],
    [p.sectors?.length || 0, "sectors"],
    [p.projectTypes?.length || 0, "project types"],
    [services, "services"],
    [p.servicePages?.length || 0, "service pages"],
  ];

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save(p);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(([k, label, hint]) => (
          <div key={k} className="flex flex-col gap-1">
            <Label htmlFor={`profile-${k}`}>{label}</Label>
            <Input id={`profile-${k}`} value={p[k] || ""} onChange={set(k)} />
            <p className="text-xs text-gray-500">{hint}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="profile-about">About the company</Label>
        <Textarea id="profile-about" rows={3} value={p.about || ""} onChange={set("about")} />
        <p className="text-xs text-gray-500">A few sentences the AI writes from: what you do, for whom, what makes you different.</p>
      </div>
      <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
        <p className="text-sm font-medium text-gray-900">Website option lists</p>
        <p className="text-xs text-gray-600">
          {counts.map(([n, l]) => `${n} ${l}`).join(" · ")}. Case studies must use these exact values; they come from your website&apos;s case study editor.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload /> Upload profile file
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={download}>
            <Download /> Download
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </div>
      <Button type="submit" className="w-fit" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} Save
      </Button>
    </form>
  );
}
