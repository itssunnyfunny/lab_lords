## 2024-05-24 - Rate Limiting on Branch-Scoped Sensitive Endpoints
**Vulnerability:** Staff invite endpoint lacked rate limiting, allowing potential abuse or brute-force invitation spamming.
**Learning:** Rate limit keys on branch-specific endpoints must incorporate the branch ID to properly scope limits per user per branch. Checks must happen after authentication to use the user ID as actor, but before request payload parsing to save compute on rejected requests.
**Prevention:** Use `checkRateLimit` and `getRequestRateLimitKey` from `@/lib/rateLimit` on all state-mutating API routes, returning 429 status and `Retry-After` headers on rejection.
