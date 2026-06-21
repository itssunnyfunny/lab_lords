## 2026-06-21 - Prevent Staff Invite Spam
**Vulnerability:** Missing rate limit on staff invite creation API endpoint
**Learning:** Branch-scoped endpoints need their rate limiting scoped to the branch as well so one branch limit doesn't affect another.
**Prevention:** Apply `checkRateLimit` to sensitive mutation endpoints like staff invites and use branch ID in the rate limit key.
