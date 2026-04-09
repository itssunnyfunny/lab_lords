## 2025-04-09 - Auth Bypass Vulnerability in Next.js API Routes
**Vulnerability:** API routes were trusting the `x-user-id` header sent by the client to determine the authenticated user's identity, allowing trivial spoofing and authorization bypass.
**Learning:** In a codebase mimicking authentication during development, extracting session identity directly from HTTP request headers opens a major security loophole. Client-side HTTP headers can be easily manipulated by an attacker.
**Prevention:** Always use a trusted server-side authentication utility (like `getSessionUser()` in this repository) to securely retrieve session state rather than reading unverified user identity directly from headers.
