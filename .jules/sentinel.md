## 2026-05-16 - Rate Limiting Pattern
**Vulnerability:** Missing rate limiting on state-mutating endpoints
**Learning:** Certain endpoints (like staff-invites and onboarding) can be abused for spam or brute-force attacks without proper rate limits.
**Prevention:** Use `checkRateLimit` and `getRequestRateLimitKey` from `@/lib/rateLimit` on sensitive, state-mutating API routes.
