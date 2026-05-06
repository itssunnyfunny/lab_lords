export function isAuthBypassEnabled() {
  return process.env.NODE_ENV !== "production"
    && process.env.NEXT_PUBLIC_AUTH_BYPASS_ENABLED === "true";
}

export function getAuthBypassEmail() {
  return (process.env.AUTH_BYPASS_EMAIL || "alice@lablord.com").trim().toLowerCase();
}
