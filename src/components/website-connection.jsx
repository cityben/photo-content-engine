"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client-api";

const NEEDED = ["content:write", "media:write", "analytics:read"];

function CheckResult({ check }) {
  if (!check) return null;
  if (!check.configured) return <p className="rounded-md bg-gray-50 p-3 text-gray-700">Add an API key to test the connection.</p>;
  if (!check.ok) {
    return (
      <p className="flex items-start gap-2 rounded-md bg-destructive-soft p-3 text-destructive">
        <CircleAlert className="mt-0.5 size-4 shrink-0" /> {check.error}
      </p>
    );
  }
  const scopes = check.me?.scopes || [];
  const missing = NEEDED.filter((s) => !scopes.includes(s));
  return (
    <div className="flex flex-col gap-1 rounded-md bg-marker-soft p-3 text-gray-900">
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="size-4" /> Connected to {check.apiBase}
        {check.me?.name ? ` as “${check.me.name}”` : ""}
      </p>
      <p className="text-xs">
        Level {check.me?.level || "—"} · scopes {scopes.join(", ") || "none"}
        {check.me?.expiresAt ? ` · expires ${new Date(check.me.expiresAt).toLocaleDateString("en-GB")}` : ""}
      </p>
      {missing.length > 0 && <p className="text-xs text-destructive">Missing scope{missing.length > 1 ? "s" : ""}: {missing.join(", ")} — some features won&apos;t work.</p>}
    </div>
  );
}

export function WebsiteConnectionForm({ initial, initialCheck }) {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState(initial.urlSource === "settings" ? initial.apiBase : "");
  const [apiKey, setApiKey] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(null);
  const [check, setCheck] = useState(initialCheck);
  const [config, setConfig] = useState(initial);

  const call = async (kind, fn) => {
    setBusy(kind);
    try {
      return await fn();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const test = () =>
    call("test", async () => {
      const r = await api("/api/settings/website", { method: "POST", body: { apiUrl: apiUrl || undefined, apiKey: apiKey || undefined } });
      setCheck(r.check);
    });

  const save = (body, message) =>
    call("save", async () => {
      const r = await api("/api/settings/website", { method: "PUT", body });
      setConfig(r.website);
      setCheck(r.check);
      setApiKey("");
      toast.success(message);
      router.refresh();
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save({ apiUrl, ...(apiKey && { apiKey }) }, "Website connection saved.");
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="website-url">Website address</Label>
        <Input id="website-url" inputMode="url" autoComplete="off" spellCheck={false} placeholder={config.siteUrl || "https://www.example.co.uk"} value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
        <p className="text-xs text-gray-500">
          The site that runs the website admin — a staging domain until launch, then your main domain. The API is at <code className="font-mono">/api/v1</code> on it.
          {config.urlSource !== "settings" && config.apiBase && ` Now using ${config.apiBase} from the environment.`}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="website-key">API key</Label>
        <div className="flex gap-2">
          <Input
            id="website-key"
            type={show ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            placeholder={config.keyHint ? `Saved: ${config.keyHint} — paste a new key to replace it` : "cc_live_…"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <Button type="button" variant="outline" size="icon" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide key" : "Show key"}>
            {show ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          {config.keySource === "settings"
            ? `Saved here, encrypted${config.updatedBy ? ` — last changed by ${config.updatedBy}` : ""}.`
            : config.keySource === "env"
              ? "Coming from the WEBSITE_API_KEY environment variable. A key saved here takes over."
              : "Not set."}{" "}
          The key is never shown again after saving.
        </p>
        {config.keyError && <p className="text-xs text-destructive">{config.keyError}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={Boolean(busy)}>
          {busy === "save" && <Loader2 className="animate-spin" />} Save
        </Button>
        <Button type="button" variant="outline" onClick={test} disabled={Boolean(busy)}>
          {busy === "test" && <Loader2 className="animate-spin" />} Test connection
        </Button>
        {config.keySource === "settings" && (
          <Button type="button" variant="ghost" className="text-destructive" disabled={Boolean(busy)} onClick={() => window.confirm("Remove the saved API key?") && save({ clearKey: true }, "Saved key removed.")}>
            Remove saved key
          </Button>
        )}
      </div>
      <CheckResult check={check} />
    </form>
  );
}
