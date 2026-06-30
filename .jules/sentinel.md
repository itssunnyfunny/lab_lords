## 2024-10-26 - Missing Rate Limiting on State-Mutating Routes
**Vulnerability:** Missing rate limiting on sensitive, state-mutating endpoints like sending staff invites.
**Learning:** Without rate limiting, attackers can brute-force endpoints or cause denial of service. Rate limit keys should be scoped appropriately (e.g., by branchId) to prevent global lockouts. Rate limiting must occur after auth to use the user ID as an actor key but before parsing the request body to save compute.
**Prevention:** Implement checkRateLimit and getRequestRateLimitKey on all sensitive API routes. Ensure a 429 status and Retry-After header are returned on rejection.
