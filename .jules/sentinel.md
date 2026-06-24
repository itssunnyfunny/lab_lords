## 2026-06-19 - [Missing Rate Limit on Sensitive Endpoint]
**Vulnerability:** Missing rate limit on the branch staff invite generation POST endpoint, allowing potential abuse or brute-force.
**Learning:** Sensitive mutative endpoints require rate limiting but it's not always applied universally. Needs branch-specific limiting because users might have different limits per branch.
**Prevention:** Apply checkRateLimit correctly and properly scope the rate limit key to the target resource.
