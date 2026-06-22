## 2024-06-22 - Missing Rate Limiting on Branch Endpoints
**Vulnerability:** Missing rate limiting on staff invite creation endpoint allowed potential brute-force or abuse per-branch.
**Learning:** Branch-specific endpoints require rate limiting keys to be scoped to the specific branch (e.g., `staff-invite-${branchId}`) alongside the user ID, rather than using a global action identifier.
**Prevention:** Apply `checkRateLimit` with branch-scoped keys after user authentication and before body parsing on state-mutating branch API endpoints.
