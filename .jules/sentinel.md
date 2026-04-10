## 2024-05-18 - Fix Authorization Bypass via Spoofable Header
**Vulnerability:** API routes (`app/api/organizations/[orgId]/branches/route.ts`, `app/api/organizations/route.ts`, and `app/api/onboarding/route.ts`) were directly trusting the `x-user-id` HTTP header for user authentication and authorization logic.
**Learning:** Extracting user identity directly from request headers (`req.headers.get("x-user-id")`) in server-side API routes is extremely dangerous because headers can be easily spoofed by any client, leading to a critical authentication bypass.
**Prevention:** Always use a secure server-side session management utility (like `getSessionUser()` from `@/lib/auth`) to verify user identity, rather than trusting unverified client-provided headers.
