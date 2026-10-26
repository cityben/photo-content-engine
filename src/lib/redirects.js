// Only same-site paths, so the login page can't be used to bounce users elsewhere.
export function safeCallback(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}
