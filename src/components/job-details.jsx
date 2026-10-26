"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SECTORS = [
  "Commercial",
  "Retail & Hospitality",
  "Education",
  "Healthcare",
  "Data Centres",
  "Industrial",
  "Residential",
];

export function JobDetails({ value, onChange, disabled }) {
  const set = (key) => (v) => onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="job_title">Job title</Label>
        <Input
          id="job_title"
          placeholder="e.g. VRF system install, 3rd floor offices"
          value={value.job_title}
          onChange={(e) => set("job_title")(e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sector">Sector</Label>
        <Select value={value.sector} onValueChange={set("sector")} disabled={disabled}>
          <SelectTrigger id="sector">
            <SelectValue placeholder="Detect from photo" />
          </SelectTrigger>
          <SelectContent>
            {SECTORS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          placeholder="e.g. Canary Wharf, London"
          value={value.location}
          onChange={(e) => set("location")(e.target.value)}
          disabled={disabled}
        />
      </div>
      <p className="text-xs text-gray-500">
        All optional. Anything you leave blank is read from the photo.
      </p>
    </div>
  );
}
