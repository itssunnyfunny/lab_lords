
## 2026-06-16 - Rate Limiting on Branch Endpoints
**Vulnerability:** Missing rate limiting on sensitive, state-mutating API routes (staff invites POST).
**Learning:** When implementing rate limiting on branch-specific endpoints, incorporate the 'branchId' into the rate limit key (e.g., `staff-invite-${branchId}`) to properly scope the limits per user per branch, rather than using a global action identifier.
**Prevention:** Apply rate limits using `getRequestRateLimitKey` and `checkRateLimit` on sensitive API endpoints to prevent brute force and abuse.
