## $(date +%Y-%m-%d) - [Authentication Bypass via Client Headers]
**Vulnerability:** Several sensitive API endpoints (e.g., organizations, branches, onboarding) relied on the `x-user-id` header passed from the client instead of extracting the user from a secure server-side session.
**Learning:** Depending on unsanitized headers for identity assertion allows attackers to trivially impersonate any user by crafting custom HTTP requests. Always establish trust at the session level.
**Prevention:** Use a centralized secure authentication handler (e.g., `getSessionUser()`) inside API routes that verifies token/cookie validity securely instead of extracting identities directly from incoming requests.
