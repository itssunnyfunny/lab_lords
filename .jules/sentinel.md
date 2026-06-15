
## 2024-05-24 - Rate Limiting on Branch-Scoped Endpoints
**Vulnerability:** Missing rate limit on staff invite endpoint, allowing for spam and brute-force attacks.
**Learning:** Endpoints under specific branches must incorporate the `branchId` in their rate limit key, instead of a global key, to correctly scope limits per user, per branch. Also rate limits must be checked *after* auth but *before* body parsing to save server resources on rejected requests.
**Prevention:** Use `getRequestRateLimitKey(req, namespace, userId)` to generate scoped rate-limiting keys and perform checks using `checkRateLimit` immediately after resolving the authenticated session.
