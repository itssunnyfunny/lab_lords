## 2025-02-14 - Fix Auth Bypass in API Routes

**Vulnerability:** API routes were trusting the `x-user-id` header from client requests to determine the authenticated user.
**Learning:** This allowed any client to spoof their identity and bypass authorization checks by supplying an arbitrary `x-user-id`.
**Prevention:** Always verify authentication using securely managed sessions (e.g., `getSessionUser()` from `@/lib/auth`) instead of relying on client-provided headers for sensitive operations.
