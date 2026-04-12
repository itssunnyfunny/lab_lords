## 2024-02-14 - Authentication Bypass via Insecure Header Spoofing
**Vulnerability:** API routes were authenticating users directly from the unverified `x-user-id` request header.
**Learning:** Hardcoding or blindly trusting client-supplied headers for authentication bypasses identity verification. Any client could spoof this header to perform administrative actions as another user.
**Prevention:** Always resolve the authenticated user securely on the backend (e.g., via session tokens/cookies) using centralized functions like `getSessionUser()` in `@/lib/auth`. Never read identity state directly from `req.headers` on public endpoints.
