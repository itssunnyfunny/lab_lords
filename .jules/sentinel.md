## 2024-06-29 - Missing Rate Limiting on Branch Staff Invites
**Vulnerability:** The POST endpoint `app/api/branches/[branchId]/staff-invites/route.ts` allowed authenticated users to create staff invitations without any rate limiting.
**Learning:** Even internal or authenticated endpoints can be targets for brute-force attacks (e.g., token generation) or denial-of-service, leading to resource exhaustion or potential abuse.
**Prevention:** Implement the custom rate-limiting utilities (like `checkRateLimit` and `getRequestRateLimitKey` from `@/lib/rateLimit`) on all sensitive state-mutating endpoints, scoping the limit key appropriately (e.g., including the `branchId`).
