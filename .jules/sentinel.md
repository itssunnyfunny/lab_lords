
## 2024-06-21 - [Missing Rate Limiting on Branch Staff Invites]
**Vulnerability:** Missing rate limiting on the `/api/branches/[branchId]/staff-invites` POST endpoint could allow malicious actors to brute-force or spam invite creation requests.
**Learning:** State-mutating branch API routes must implement scoping limits properly; applying rate limiting keys that consider the branch identifier per user is crucial to avoiding broad or global restrictions.
**Prevention:** Always implement `checkRateLimit` immediately after user authentication but prior to parsing request bodies (`req.json()`) using a properly scoped namespace (e.g., `staff-invite-${branchId}`) to conserve server resources and defend against abuse.
