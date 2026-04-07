## 2024-05-18 - Auth Bypass via Header Spoofing
**Vulnerability:** Multiple API endpoints (organizations, onboarding) were reading the `x-user-id` HTTP header directly from incoming requests to establish user identity, allowing for trivial authentication bypass.
**Learning:** The frontend might have been sending this header for temporary auth, but the backend trusted client-supplied data unconditionally rather than using a secure server-side session mechanism.
**Prevention:** Always use secure, server-side session management (like `getSessionUser()`) to verify identity. Never trust unverified HTTP headers or client-provided identifiers for authentication or authorization logic.
