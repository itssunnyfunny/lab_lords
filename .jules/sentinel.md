## 2024-06-12 - Missing Rate Limiting on State-Mutating Endpoints
**Vulnerability:** Sensitive, state-mutating API endpoints (like staff invite creation and onboarding) lacked rate limiting, making them susceptible to abuse and brute-force attacks.
**Learning:** Performing `checkRateLimit` checks after user authentication (using `user.id` as the actor key) but before parsing the request body (`req.json()`) is an effective way to implement rate limits while conserving server compute resources on rejected requests.
**Prevention:** Always implement rate limiting on endpoints that perform sensitive operations or send external communications (like invites), ensuring the check is done as early as possible in the request lifecycle after authentication.
