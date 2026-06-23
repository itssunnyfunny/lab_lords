
## 2026-06-23 - Rate Limiting on State-Mutating APIs
**Vulnerability:** Missing rate limiting on sensitive, state-mutating endpoints (onboarding, staff invites) allows for abuse and brute-force attacks.
**Learning:** API routes need explicit rate limit checks after authentication but before body parsing to protect compute resources and prevent spam.
**Prevention:** Use `checkRateLimit` and `getRequestRateLimitKey` (scoping by branchId when appropriate) on all state-mutating endpoints, returning 429 with a Retry-After header.
