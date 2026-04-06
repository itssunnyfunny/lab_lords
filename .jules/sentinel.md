## 2024-04-06 - [Header Spoofing Authentication Bypass]
**Vulnerability:** Several core API routes (`organizations`, `branches`, `onboarding`) were extracting the authenticated user ID directly from the raw `x-user-id` HTTP header.
**Learning:** Using client-provided headers for authentication/authorization creates a trivial spoofing vector where any user can manipulate the header to impersonate another user and access or modify their resources.
**Prevention:** Always use the secure, server-side session management function `getSessionUser()` from `@/lib/auth` to establish identity on API routes, rather than trusting raw request headers.
