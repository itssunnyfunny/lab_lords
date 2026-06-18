## 2024-06-18 - Missing Rate Limiting on State-Mutating Endpoints
**Vulnerability:** API endpoints that mutate state (like sending staff invites or onboarding) were missing rate limits, allowing potential abuse or brute-force attacks.
**Learning:** Rate limiting is critical for endpoints that perform actions like sending emails or creating core resources to prevent spam and resource exhaustion. It must be checked *after* authentication (to key by user.id) but *before* parsing the request body to save compute resources on rejected requests.
**Prevention:** Always implement rate limiting on sensitive or state-mutating Next.js API routes using `checkRateLimit` from `@/lib/rateLimit`.
