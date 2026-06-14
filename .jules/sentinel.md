## 2024-06-14 - Scoping Rate Limit Keys Correctly
 **Vulnerability:** Global rate limits on multi-tenant or multi-resource endpoints can block legitimate user actions across different resources.
 **Learning:** When a user takes an action on a specific resource (like a branch), the rate limit key must include both the user ID and the resource ID to prevent actions in Branch A from exhausting the limit for Branch B.
 **Prevention:** Always include the resource identifier (e.g., `branchId`) in the rate limit namespace or key generator when securing branch-specific or organization-specific API routes.
