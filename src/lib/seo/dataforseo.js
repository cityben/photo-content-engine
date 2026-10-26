/**
 * DataForSEO v3 client (https://api.dataforseo.com, HTTP Basic).
 *
 * Pay-per-request, so three guards:
 *   - results are cached in the store (see market.js); pages read the cache
 *     and only a "Refresh" spends money;
 *   - DATAFORSEO_MONTHLY_BUDGET (USD, default 20) is checked before each call
 *     against this month's logged spend;
 *   - DATAFORSEO_SANDBOX=true uses DataForSEO's free sandbox (dummy data).
 *
 * Request/response shapes follow the official dataforseo-client (v2.1.10).
 */

import { collection } from "@/lib/store";

export const UK = { location_code: 2826, language_code: "en" };

export function dataforseoConfigured() {
  return Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

export const isSandbox = () => process.env.DATAFORSEO_SANDBOX === "true";
// DATAFORSEO_API_URL is only for pointing at a mock in local tests.
const baseUrl = () => process.env.DATAFORSEO_API_URL || (isSandbox() ? "https://sandbox.dataforseo.com" : "https://api.dataforseo.com");
export const monthlyBudget = () => Number(process.env.DATAFORSEO_MONTHLY_BUDGET || 20);

export class DataForSeoError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "DataForSeoError";
    this.status = status;
  }
}

const usage = () => collection("dataforseo_usage");

/** USD spent this calendar month (from our own log of each call's `cost`). */
export async function monthSpend(now = new Date()) {
  const month = now.toISOString().slice(0, 7);
  const rows = await usage().find({ month });
  return rows.reduce((sum, r) => sum + (r.cost || 0), 0);
}

async function logCost(path, cost) {
  try {
    await usage().insert({ month: new Date().toISOString().slice(0, 7), path, cost: Number(cost) || 0, sandbox: isSandbox() });
  } catch (error) {
    console.error("[dataforseo] couldn't log cost:", error.message);
  }
}

function authHeader() {
  return `Basic ${Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString("base64")}`;
}

async function call(method, path, task) {
  if (!dataforseoConfigured()) throw new DataForSeoError("DataForSEO isn't connected. Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.");
  if (!isSandbox()) {
    const spent = await monthSpend();
    if (spent >= monthlyBudget()) {
      throw new DataForSeoError(
        `This month's DataForSEO budget ($${monthlyBudget().toFixed(2)}) is used up ($${spent.toFixed(2)} spent). Raise DATAFORSEO_MONTHLY_BUDGET to continue.`
      );
    }
  }

  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: { Authorization: authHeader(), "Content-Type": "application/json", Accept: "application/json" },
    ...(task ? { body: JSON.stringify([task]) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(60000),
  });
  if (res.status === 401) throw new DataForSeoError("DataForSEO rejected the login. Use the API login and password from your DataForSEO dashboard.", { status: 401 });
  const body = await res.json().catch(() => null);
  if (!body) throw new DataForSeoError(`DataForSEO error (${res.status})`, { status: res.status });
  if (body.cost) await logCost(path, body.cost);
  if (body.status_code !== 20000) throw new DataForSeoError(`DataForSEO: ${body.status_message}`, { status: res.status });
  const t = body.tasks?.[0];
  if (!t) throw new DataForSeoError("DataForSEO: no result");
  return { task: t, cost: body.cost || 0 };
}

/** Live endpoints: the result, or an error. */
export async function post(path, task) {
  const { task: t, cost } = await call("POST", path, task);
  if (t.status_code !== 20000) throw new DataForSeoError(`DataForSEO: ${t.status_message || "no result"}`);
  return { result: t.result || [], cost };
}

export async function get(path) {
  const { task: t, cost } = await call("GET", path);
  if (t.status_code !== 20000) throw new DataForSeoError(`DataForSEO: ${t.status_message || "no result"}`);
  return { result: t.result || [], cost };
}

/**
 * Queued endpoints (reviews): task_post answers 20100 "Task Created" with an
 * id; task_get answers 40601/40602 (handed / in queue) until it's done.
 */
export async function postTask(path, task) {
  const { task: t, cost } = await call("POST", path, task);
  if (t.status_code !== 20100) throw new DataForSeoError(`DataForSEO: ${t.status_message || "task not created"}`);
  return { id: t.id, cost };
}

export const PENDING_CODES = [40601, 40602];

export async function getTask(path) {
  const { task: t, cost } = await call("GET", path);
  if (PENDING_CODES.includes(t.status_code)) return { ready: false, cost };
  if (t.status_code !== 20000) throw new DataForSeoError(`DataForSEO: ${t.status_message || "no result"}`);
  return { ready: true, result: t.result || [], cost };
}

/** Remaining balance on the DataForSEO account (USD). */
export async function accountBalance() {
  const { result } = await get("/v3/appendix/user_data");
  return result?.[0]?.money?.balance ?? null;
}
