## 2024-05-18 - Missing Rate Limiting on State-Mutating Endpoints
**Vulnerability:** Missing rate limit on POST /api/onboarding and POST /api/branches/[branchId]/staff-invites.
**Learning:** Sensitive, state-mutating API routes are susceptible to abuse and brute-force attacks without rate limiting.
**Prevention:** Implement rate-limiting using checkRateLimit and getRequestRateLimitKey on state-mutating API endpoints.
