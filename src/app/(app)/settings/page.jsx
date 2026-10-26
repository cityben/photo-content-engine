import { CheckCircle2, CircleAlert, Circle } from "lucide-react";

import { ModelPicker } from "@/components/model-picker";
import { ChannelChip } from "@/components/post-row";
import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { gatewayCredits, modelCatalog } from "@/lib/models";
import { accountBalance, dataforseoConfigured, isSandbox, monthlyBudget, monthSpend } from "@/lib/seo/dataforseo";
import { setupStatus } from "@/lib/setup";
import { checkStorage } from "@/lib/store";
import { listChannels, socialMode, status as socialStatus } from "@/lib/social";
import { money } from "@/lib/ui-labels";
import { checkWebsiteConnection, WEBSITE_URL } from "@/lib/website-api";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings — Content Engine" };

function Env({ children }) {
  return <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800">{children}</code>;
}

function StatusIcon({ state }) {
  if (state === "ok") return <CheckCircle2 className="size-5 shrink-0 text-green-700" />;
  if (state === "error") return <CircleAlert className="size-5 shrink-0 text-destructive" />;
  return <Circle className="size-5 shrink-0 text-gray-400" />;
}

function Integration({ title, state, summary, children }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <StatusIcon state={state} />
          <div className="flex flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{summary}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm leading-6 text-gray-700">{children}</CardContent>
    </Card>
  );
}

export default async function SettingsPage() {
  const setup = Object.fromEntries(
    (await setupStatus().catch((error) => {
      console.error("[settings] setup status failed:", error);
      return [];
    })).map((s) => [s.id, s])
  );
  const fallback = { done: false, detail: "Couldn't check.", fix: "" };
  for (const id of ["ai", "storage", "photos", "buffer", "website", "auth"]) setup[id] ??= fallback;
  // Each check fails on its own and shows its error, so one broken
  // connection can't take the whole page down.
  const settle = (promise, fallback, label) =>
    promise.catch((error) => {
      console.error(`[settings] ${label} failed:`, error);
      return typeof fallback === "function" ? fallback(error) : fallback;
    });
  const seoOn = dataforseoConfigured();
  const [buffer, channels, website, catalog, credits, storage, seoSpend, seoBalance] = await Promise.all([
    settle(socialStatus(), (e) => ({ mode: socialMode(), ok: false, error: e.message }), "buffer"),
    settle(listChannels(), [], "channels"),
    settle(checkWebsiteConnection(), (e) => ({ configured: true, ok: false, error: e.message }), "website"),
    settle(modelCatalog(), (e) => ({ active: "", shortlist: [], others: [], usage: { inputTokens: 0, outputTokens: 0 }, error: e.message }), "models"),
    settle(gatewayCredits(), null, "credits"),
    settle(checkStorage(), (e) => ({ ok: false, error: e.message }), "storage"),
    settle(monthSpend(), null, "dataforseo spend"),
    seoOn ? settle(accountBalance().then((balance) => ({ balance })), (e) => ({ error: e.message }), "dataforseo") : null,
  ]);
  const scopes = website.me?.scopes || website.me?.key?.scopes;

  return (
    <>
      <PageHeader
        title="Settings"
        description="What's connected. Keys live in Vercel → Project → Settings → Environment Variables; redeploy after changing them. This page never shows their values."
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>AI model</CardTitle>
              <CardDescription>
                Which model writes your posts, case studies and advice. All run through the Vercel AI Gateway — one bill, no provider keys.
                Override per job with Rewrite → Model.
              </CardDescription>
            </div>
            {credits && (
              <Badge variant="secondary">
                Gateway credit {money(Number(credits.balance))} · used {money(Number(credits.totalUsed))}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ModelPicker catalog={catalog} />
          <p className="mt-3 text-xs text-gray-500">
            Locally the gateway needs <Env>AI_GATEWAY_API_KEY</Env>; on Vercel it signs in automatically. <Env>AI_GATEWAY_MODEL</Env> sets the default until you pick one here.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Integration
          title="Buffer"
          state={socialMode() === "sandbox" ? "off" : buffer.ok ? "ok" : "error"}
          summary={setup.buffer.detail}
        >
          {buffer.error && <p className="rounded-md bg-destructive-soft p-3 text-destructive">{buffer.error}</p>}
          {buffer.account && (
            <p>
              Signed in as <span className="font-medium">{buffer.account.email}</span>
              {buffer.account.organizations?.length > 1 && ` · using "${buffer.account.organizations[0].name}" (set BUFFER_ORGANIZATION_ID to change)`}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {channels.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5">
                <ChannelChip service={c.service} name={c.name} />
                {c.paused && <Badge variant="secondary">queue paused</Badge>}
                {c.disconnected && <Badge variant="destructive">reconnect in Buffer</Badge>}
              </span>
            ))}
            {!channels.length && <span className="text-gray-500">No LinkedIn or Instagram channels found.</span>}
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-gray-600">
            <li>In Buffer, connect your LinkedIn page and Instagram business account.</li>
            <li>Buffer → Settings → API → create a key. Add it as <Env>BUFFER_API_KEY</Env>.</li>
            <li>
              Add <Env>ENABLE_BUFFER_POSTING=true</Env> when you&apos;re ready to schedule for real. Until then the calendar and stats are read-only.
            </li>
            <li>
              To test safely on real accounts, pause the channel&apos;s queue in Buffer — posts can be scheduled, edited and deleted but won&apos;t publish.
            </li>
            <li>
              Force the sandbox any time with <Env>SOCIAL_MODE=sandbox</Env>.
            </li>
          </ol>
        </Integration>

        <Integration
          title="Website"
          state={!website.configured ? "off" : website.ok ? "ok" : "error"}
          summary={`${WEBSITE_URL} — case study drafts, photo uploads, Search Console and traffic reports.`}
        >
          {website.error && <p className="rounded-md bg-destructive-soft p-3 text-destructive">{website.error}</p>}
          {website.ok && (
            <p>
              Connected{website.me?.name ? ` as "${website.me.name}"` : ""}
              {Array.isArray(scopes) && ` · scopes: ${scopes.join(", ")}`}
            </p>
          )}
          <ol className="list-decimal space-y-1 pl-5 text-gray-600">
            <li>
              Sign in to the website admin as a developer and open <Env>/admin/api-keys</Env>.
            </li>
            <li>
              Create a key with role <strong>editor</strong> and scopes <Env>content:write</Env> <Env>media:write</Env> <Env>analytics:read</Env>. Leave allowed origins empty (this app calls from its server).
            </li>
            <li>
              Add it as <Env>WEBSITE_API_KEY</Env> (starts <Env>cc_live_</Env>). <Env>WEBSITE_API_SECRET</Env> isn&apos;t used by the website and can be removed.
            </li>
          </ol>
        </Integration>

        <Integration
          title="DataForSEO"
          state={!seoOn ? "off" : seoBalance?.error ? "error" : "ok"}
          summary="Competitors, keyword demand, trends, reviews, brand and AI mentions, backlinks and page checks (Search & market, Reputation & authority)."
        >
          {seoBalance?.error && <p className="rounded-md bg-destructive-soft p-3 text-destructive">{seoBalance.error}</p>}
          {seoOn && (
            <p>
              {isSandbox() ? "Sandbox — free dummy data. " : ""}This month: <strong>{seoSpend != null ? money(seoSpend) : "—"}</strong> of {money(monthlyBudget())} budget
              {seoBalance?.balance != null && <> · account balance {money(seoBalance.balance)}</>}
            </p>
          )}
          <ol className="list-decimal space-y-1 pl-5 text-gray-600">
            <li>
              Sign up at dataforseo.com and open <strong>API Access</strong> in the dashboard (the API password is not your login password).
            </li>
            <li>
              Add <Env>DATAFORSEO_LOGIN</Env> and <Env>DATAFORSEO_PASSWORD</Env>. Try it first with <Env>DATAFORSEO_SANDBOX=true</Env> (free dummy data).
            </li>
            <li>
              <Env>DATAFORSEO_MONTHLY_BUDGET</Env> (USD, default 20) stops refreshes once this month&apos;s spend reaches it. Pages only read stored results; only the Refresh buttons spend.
            </li>
          </ol>
        </Integration>

        <Integration
          title="Storage"
          state={!storage.ok ? "error" : setup.storage.done && setup.photos.done ? "ok" : "off"}
          summary="Where jobs and photos are kept."
        >
          {!storage.ok && <p className="rounded-md bg-destructive-soft p-3 text-destructive">{storage.error}</p>}
          {storage.ok && storage.mode === "mongodb" && <p className="text-green-800">Database reachable ({storage.database}).</p>}
          <p>
            <span className="font-medium">Database:</span> {setup.storage.detail}
            {!setup.storage.done && <span className="block text-gray-600">{setup.storage.fix}</span>}
          </p>
          <p>
            <span className="font-medium">Photos:</span> {setup.photos.detail}
            {!setup.photos.done && <span className="block text-gray-600">{setup.photos.fix}</span>}
          </p>
        </Integration>

        <Integration title="Sign-in" state={setup.auth.done ? "ok" : "error"} summary={setup.auth.detail}>
          <p className="text-gray-600">
            Add people with <Env>npm run hash-password -- name@example.co.uk</Env> and put the line in <Env>AUTH_USERS</Env>. Sessions last 12 hours.
          </p>
        </Integration>
      </div>
    </>
  );
}
