
## 2024-05-18 - Missing Rate Limiting on Branch Staff Invites
**Vulnerability:** The POST endpoint for creating staff invites (`/api/branches/[branchId]/staff-invites`) lacked rate limiting, allowing potential abuse or brute-forcing of staff invites.
**Learning:** Branch-specific endpoints need rate limiting scoped to both the user and the branch to prevent abuse while ensuring legitimate use isn't overly restricted across different branches.
**Prevention:** Incorporate the `branchId` into the rate limit key (e.g., `staff-invite-${branchId}`) using `getRequestRateLimitKey` and apply `checkRateLimit` after authentication but before parsing the request body to conserve server resources. Always return a 429 status with a `Retry-After` header.
