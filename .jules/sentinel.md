
## 2026-06-12 - Missing Rate Limiting on Staff Invites
**Vulnerability:** The POST endpoint for creating staff invites was missing rate limiting protection.
**Learning:** Sensitive endpoints that mutate state or send communications (like invites) are vulnerable to abuse or brute-force attacks if not rate-limited.
**Prevention:** Always apply the `checkRateLimit` utility to sensitive POST/PATCH mutation endpoints after authentication but before processing the request body.
