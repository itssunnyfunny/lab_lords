## 2024-05-24 - Rate Limiting on Branch Endpoints
**Vulnerability:** Missing rate limiting on sensitive API routes like staff invites allows brute-force and spam attacks.
**Learning:** Performing rate limits after authentication but before body parsing conserves server resources while still accurately attributing requests per user per branch.
**Prevention:** Use checkRateLimit with an actor-specific key incorporating IDs (like user.id and branchId) and return 429 with Retry-After header.
