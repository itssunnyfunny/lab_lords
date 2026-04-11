
## 2024-05-18 - Auth Bypass via Header Spoofing
**Vulnerability:** API routes were authenticating users by reading the `x-user-id` header directly from incoming requests.
**Learning:** Client-provided HTTP headers can be easily spoofed by malicious actors. Relying on them for authentication or authorization allows attackers to impersonate any user.
**Prevention:** Never use raw request headers for authentication. Always use a secure, server-side session management mechanism (like `getSessionUser()`) to cryptographically verify user identity.
