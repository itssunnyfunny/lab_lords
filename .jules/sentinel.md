## 2024-05-18 - Remove client-provided x-user-id header parsing for Authentication
**Vulnerability:** Several sensitive API endpoints relied on parsing the raw `x-user-id` header from requests to establish identity and perform authorization checks. This allowed unauthenticated actors to easily spoof any user ID and bypass authentication.
**Learning:** Never rely on client-provided headers for authentication or authorization decisions. Session context must be established securely on the server.
**Prevention:** Always use the established server-side utility `getSessionUser()` from `@/lib/auth` to securely retrieve the user session state.
