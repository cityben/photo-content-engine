/** fetch wrapper for client components: JSON in/out, throws with the server's message. */
export async function api(url, { method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // Session expired: a full reload to the login page clears client state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
    throw new Error("Signed out");
  }
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}
