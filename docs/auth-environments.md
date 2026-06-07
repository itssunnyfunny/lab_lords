# Auth Environments

Lab Lords uses Clerk for real identity and Prisma `User` rows for app ownership, staff roles, settings, and audit history.

## Local Development

Use a Clerk development instance for local work. Development keys intentionally show Clerk's development-mode banner.

Required local `.env` values:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/org"
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="/onboarding"
```

Smooth seeded demo account:

1. Run migrations and seed local data.
2. In the Clerk development dashboard, create or sign up a user with `alice@lablord.com`.
3. Sign in locally at `http://localhost:3000/sign-in`.
4. The first authenticated request links Clerk's user ID to the seeded local Alice row.

Seeded emails that already have app data:

- `alice@lablord.com` owner demo account
- `bob@lablord.com` owner plus manager demo account
- `carol@lablord.com` manager demo account
- `dave@lablord.com` staff demo account

If you sign in with a different email, the app creates a new local user and sends you through onboarding.

## Tests

Tests use `.env.test` and a separate PostgreSQL database whose URL must include `test`.

Clerk keys are not needed for Vitest. Clerk/auth behavior is mocked in tests that need it.

## Production

Production should use a separate Clerk production instance, live keys, and a production database.

Required production environment values:

```bash
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/org"
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="/onboarding"
```

Production checklist:

- Configure allowed origins and redirect URLs in Clerk for the deployed domain.
- Use live Clerk keys only in the production hosting environment.
- Run Prisma migrations against the production database before traffic.
- Do not seed demo data into production unless deliberately creating a demo tenant.

## Check The Current Env

Run:

```bash
pnpm auth:check
```

For the test env:

```bash
pnpm auth:check .env.test
```
