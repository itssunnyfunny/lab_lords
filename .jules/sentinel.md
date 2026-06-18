## 2026-06-14 - Scope Rate Limits to Resources
**Vulnerability:** Missing rate limiting on branch-specific invite generation allows potential abuse and denial of service.
**Learning:** Rate limits for resource-specific endpoints must incorporate the resource ID (like branchId) into the rate limit key to correctly scope limits per user per branch.
**Prevention:** Apply `checkRateLimit` using a scoped key like `staff-invite-${branchId}` on all state-mutating API routes.
