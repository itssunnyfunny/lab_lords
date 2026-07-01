## 2024-07-01 - Add rate limiting to sensitive API routes
**Vulnerability:** Missing rate limiting on sensitive API endpoints like onboarding, branch creation, organization creation, and staff invites, which can lead to brute-force or DoS attacks.
**Learning:** Rate limiting is an essential defense-in-depth measure to prevent abuse of sensitive mutating operations. It should be applied after authentication to scope the limits per user and before parsing the request body to save compute resources.
**Prevention:** Always implement rate limiting on sensitive, state-mutating API routes using the `checkRateLimit` utility, incorporating relevant context like user ID and branch ID in the rate limit key.
