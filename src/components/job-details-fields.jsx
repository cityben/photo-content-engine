"use client";

import Link from "next/link";

import { useWebsiteOptions } from "@/components/options-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// The lists come from Settings → Company profile; until it's filled in there's nothing to pick.
function Choice({ id, label, value, onChange, items, placeholder, disabled }) {
  const empty = !items.length;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || ""} onValueChange={onChange} disabled={disabled || empty}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {empty && (
        <p className="text-xs text-gray-600">
          No list yet —{" "}
          <Link href="/settings#company-profile" className="font-medium text-primary underline underline-offset-4">
            add the company profile in Settings
          </Link>
          .
        </p>
      )}
    </div>
  );
}

export function JobDetailsFields({ value, onChange, disabled }) {
  const options = useWebsiteOptions();
  const set = (key) => (v) => onChange({ ...value, [key]: v });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Choice id="company" label="Division" value={value.company} onChange={set("company")} items={options.companies} placeholder="Let AI decide" disabled={disabled} />
      <Choice id="sector" label="Sector" value={value.sector} onChange={set("sector")} items={options.sectors} placeholder="Let AI decide" disabled={disabled} />
      <Choice id="projectType" label="Project type" value={value.projectType} onChange={set("projectType")} items={options.projectTypes} placeholder="Let AI decide" disabled={disabled} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" placeholder="e.g. Canary Wharf, London" value={value.location || ""} onChange={(e) => set("location")(e.target.value)} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="client">Client / building</Label>
        <Input id="client" placeholder="Only if you can name them publicly" value={value.client || ""} onChange={(e) => set("client")(e.target.value)} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="completedOn">Completed</Label>
        <Input id="completedOn" type="month" value={value.completedOn || ""} onChange={(e) => set("completedOn")(e.target.value)} disabled={disabled} />
      </div>
    </div>
  );
}
