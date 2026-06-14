## 2024-06-09 - Missing Rate Limiting on Invite URLs
**Vulnerability:** Staff invite endpoint lacked rate limiting, allowing bad actors to spam invite URLs to specific emails or generate unlimited tokens, enabling denial of service and brute-force attacks.
**Learning:** Only AI endpoints implemented rate limiting; standard sensitive state-mutating endpoints (e.g. invites) relied solely on authentication which is insufficient against a compromised account or automated spamming.
**Prevention:** Implement `checkRateLimit` and `getRequestRateLimitKey` across all sensitive action endpoints (like invites, onboarding, and generating payments) to provide defense in depth and restrict action frequency.
