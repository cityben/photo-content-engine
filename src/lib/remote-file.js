/**
 * Fetch a file from a URL given by another system — safely.
 * Only https, only public internet addresses (no localhost, private ranges or
 * cloud metadata), no redirects, size-capped, with a timeout.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateAddress(address) {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();
    if (a.startsWith("::ffff:")) return isPrivateAddress(a.slice(7));
    return a === "::1" || a === "::" || a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe80");
  }
  const [a, b] = address.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export async function fetchPublicFile(url, { maxBytes = 25 * 1024 * 1024, timeoutMs = 20000 } = {}) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Not a valid URL: ${url}`);
  }
  if (parsed.protocol !== "https:") throw new Error(`Only https URLs are accepted: ${url}`);
  if (parsed.username || parsed.password) throw new Error("URLs with credentials aren't accepted.");

  const addresses = isIP(parsed.hostname) ? [{ address: parsed.hostname }] : await lookup(parsed.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error(`That address isn't on the public internet: ${parsed.hostname}`);
  }

  const res = await fetch(parsed, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
  if (res.status >= 300 && res.status < 400) throw new Error(`Redirects aren't followed — use the final URL: ${url}`);
  if (!res.ok) throw new Error(`Couldn't download ${url} (${res.status})`);
  const declared = Number(res.headers.get("content-length"));
  if (declared && declared > maxBytes) throw new Error(`File too large: ${url}`);

  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > maxBytes) throw new Error(`File too large: ${url}`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export { isPrivateAddress };
