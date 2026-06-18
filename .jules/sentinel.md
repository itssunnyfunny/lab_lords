## 2026-06-18 - Missing Rate Limiting on Branch Staff Invites
**Vulnerability:** Missing rate limiting on sensitive, state-mutating API routes (e.g., sending invites).
**Learning:** Incorporate the `branchId` into the rate limit key (e.g., `staff-invite-${branchId}`) to properly scope the limits per user per branch, rather than using a global action identifier. Perform the `checkRateLimit` check after user authentication (to use `user.id` as the actor key) but before parsing the request body (`req.json()`) to conserve server compute resources on rejected requests.
**Prevention:** Implement `checkRateLimit` and `getRequestRateLimitKey` from `@/lib/rateLimit` on all sensitive POST routes, returning a 429 status code and `Retry-After` header when limits are exceeded.
