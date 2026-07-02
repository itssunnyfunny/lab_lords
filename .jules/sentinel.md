
## 2026-07-02 - Rate Limiting on State-Mutating Endpoints
**Vulnerability:** Sensitive API routes (staff-invites, onboarding) lacked rate limiting, exposing them to abuse and data spam.
**Learning:** Rate limiting is required on authenticated routes to prevent resource exhaustion, and it should be done before body parsing.
**Prevention:** Implement `checkRateLimit` on sensitive routes after authentication (using `user.id`), incorporate `branchId` if scoped, and always include a `Retry-After` header in the 429 response.
