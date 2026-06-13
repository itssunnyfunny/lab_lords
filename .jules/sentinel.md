
## 2024-05-18 - Missing Rate Limiting on State-Mutating API Routes
**Vulnerability:** Missing rate limiting on `app/api/branches/[branchId]/staff-invites/route.ts` and `app/api/onboarding/route.ts` allowed unrestricted access to state-mutating endpoints, making the application susceptible to denial-of-service (DoS) and brute-force attacks.
**Learning:** Even internal or authenticated endpoints that perform computationally expensive operations or create entities need rate limiting. Relying solely on UI limits or ignoring authenticated abuse paths leaves the server vulnerable to automated exhaustion.
**Prevention:** Implement the `checkRateLimit` pattern from `@/lib/rateLimit` on all state-mutating (POST/PUT/DELETE) and resource-intensive endpoints, using the user ID or IP as the rate limit key. Ensure limits are appropriately sized (e.g. 5 requests per minute for sensitive endpoints).
