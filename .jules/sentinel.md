## $(date +%Y-%m-%d) - Rate Limiting on Branch-Specific API Routes
**Vulnerability:** Missing rate limiting on sensitive API routes (e.g., POST /api/branches/[branchId]/staff-invites) allows for abuse and brute-force attacks.
**Learning:** Next.js API routes with state mutations need explicit rate limiting implemented after authentication but before body parsing, incorporating the context (e.g. branchId) into the rate limit key.
**Prevention:** Implement `@/lib/rateLimit` on all state-mutating endpoints, scoping the key to the specific branch and user (e.g., `staff-invite-${branchId}:${user.id}`). Always return 429 with `Retry-After` header.
