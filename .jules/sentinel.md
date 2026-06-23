
## 2024-05-25 - Rate Limiting State-Mutating Endpoints
**Vulnerability:** Missing rate limiting on sensitive, state-mutating API routes (like staff invites).
**Learning:** Rate limiting must be implemented after authentication to use `user.id` as the actor key but before parsing `req.json()` to save compute resources. Branch-specific routes should scope limits using `branchId` (e.g., `staff-invite-${branchId}`).
**Prevention:** Use `checkRateLimit` and `getRequestRateLimitKey` from `@/lib/rateLimit`. Always return a 429 HTTP status and include a `Retry-After` header populated with the `retryAfter` property from the rate limiter's response.
