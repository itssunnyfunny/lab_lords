
## 2026-06-20 - Rate Limiting on State-Mutating Endpoints
**Vulnerability:** Missing rate limiting on sensitive API routes like onboarding and staff invites.
**Learning:** Unrestricted endpoints can be abused for brute-force attacks, spamming, or DoS.
**Prevention:** Implement `checkRateLimit` consistently on all state-mutating (POST) endpoints, scoped to the user and relevant entity (e.g., branchId).
