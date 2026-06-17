## 2026-05-18 - [Adding Sync Rate Limits]
**Vulnerability:** Missing rate limiting on sensitive endpoint.
**Learning:** Found that `checkRateLimit` is synchronous.
**Prevention:** Ensured synchronous logic uses local buckets, which is limited in a serverless environment, but works per instance.
