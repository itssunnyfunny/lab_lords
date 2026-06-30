
## 2023-10-24 - Missing Rate Limiting on Branch-Specific API Routes
**Vulnerability:** High-impact API routes (like sending invites) lack rate limiting, allowing for potential abuse or spam.
**Learning:** Rate limiting should be applied after user authentication but before body parsing to conserve compute, and the branch ID should be incorporated into the rate limit key.
**Prevention:** Implement `checkRateLimit` with branch-scoped keys on all sensitive or state-mutating API routes.
