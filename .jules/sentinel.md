## 2026-06-24 - Rate Limiting Branch API Routes
**Vulnerability:** Missing rate limiting on state-mutating branch API routes allows brute-force/abuse.
**Learning:** Branch-specific operations require namespaced rate limit keys combining the endpoint action and branch ID to scope limits correctly per user per branch.
**Prevention:** Implement `checkRateLimit` with branch-scoped keys (e.g. `staff-invite-${branchId}`) directly after authentication and before request body parsing on all sensitive POST routes.
