
## 2026-06-25 - Rate Limiting on State-Mutating Endpoints
**Vulnerability:** Missing rate limiting on the onboarding POST endpoint allowed potential abuse and brute-force attacks.
**Learning:** State-mutating endpoints like onboarding and sending invites are targets for abuse. Checking limits after authentication but before parsing request bodies saves compute resources.
**Prevention:** Always use `getRequestRateLimitKey` and evaluate `checkRateLimit` on sensitive endpoints, returning 429 and `Retry-After` headers on rejection.
