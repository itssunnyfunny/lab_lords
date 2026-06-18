## 2026-06-17 - Missing Rate Limiting on State-Mutating Endpoints
**Vulnerability:** Sensitive state-mutating endpoints (e.g., sending invites, onboarding) were vulnerable to abuse and brute-force attacks due to missing rate limiting.
**Learning:** API routes need explicit rate limiting implemented after user authentication but before request body parsing to conserve server compute resources on rejected requests.
**Prevention:** Implement `checkRateLimit` and `getRequestRateLimitKey` from `@/lib/rateLimit` on sensitive API routes, properly scoping limits per user/branch, and returning 429 status codes with `Retry-After` headers.
