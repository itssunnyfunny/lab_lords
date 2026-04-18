
## 2024-05-15 - Auth Bypass via User Header Spoofing
**Vulnerability:** API routes extracted user IDs directly from the `x-user-id` request header.
**Learning:** This exposes the application to header injection/spoofing, where malicious users can impersonate any user simply by sending a custom header.
**Prevention:** Always rely on secure server-side session checks (e.g., `getSessionUser()` or tokens) rather than implicitly trusting client-provided headers for critical authentication.
