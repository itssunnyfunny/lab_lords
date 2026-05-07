# AGENTS.md

Guidance for coding agents working in this repository.

## Project Structure

- `app/` - Next.js App Router pages, layouts, loading/error UI, and API routes.
- `components/` - Shared React components for UI, layout, dashboards, analytics, AI, payments, allocations, and tables.
- `services/` - Backend/business logic used by API routes. This is the main domain layer.
- `lib/` - Prisma client setup, temporary auth helper, API client wrappers, and shared utilities.
- `prisma/` - Prisma schema, migrations, and seed data.
- `tests/` - Vitest unit, integration, and e2e-style tests plus test setup helpers.
- `ai/` - Gemini client, AI contracts, prompts, readers, orchestrator, reports, and risk/message generation logic.
- `analytics/` - Analytics calculations and trend helpers.
- `hooks/` - Client-side React hooks.
- `types/` - Shared TypeScript domain types.
- `utils/` - Date, money, formatting, and shift-time helpers.
- `scripts/` - Debugging, audit, and verification scripts.
- `styles/` - Design tokens and shared styling assets.
- `public/` - Static assets.

## Commands

Install dependencies:

```bash
pnpm install
```

Run locally:

```bash
pnpm dev
```

Run tests:

```bash
pnpm test
```


Run tests in watch mode:

```bash
pnpm test:watch
```

Run coverage:

```bash
pnpm test:coverage
```

Lint:

```bash
pnpm lint
```

Build:

```bash
pnpm build
```

Prisma setup commonly needed for local development:

```bash
pnpm prisma generate
pnpm prisma migrate dev
pnpm prisma db seed
```
### use if direct pnpm fails
Use Git Bash-compatible commands where possible. If running from PowerShell, use:
cmd /c "%APPDATA%\npm\pnpm.cmd" <command>
Do not use PowerShell direct invocation of pnpm.cmd.

## Environment

- Local development requires `DATABASE_URL`.
- AI/Gemini features require `GEMINI_API_KEY`.
- Tests load `.env.test`; its `DATABASE_URL` must include the word `test` or test setup will abort.
- Integration tests expect a reachable PostgreSQL test database with the Prisma schema applied.

## Coding Rules

- Use TypeScript and follow the existing Next.js App Router patterns.
- Keep business logic in `services/`; keep API route handlers thin where possible.
- Use existing helpers from `lib/`, `utils/`, `types/`, `analytics/`, and `ai/` before adding new abstractions.
- Use the `@/*` path alias for imports when it matches existing style.
- Keep changes scoped to the requested behavior.
- Do not introduce unrelated refactors, formatting churn, dependency changes, or schema changes unless asked.
- Preserve the current temporary auth behavior unless the task specifically concerns authentication.
- For database access, use the existing Prisma client from `lib/prisma.ts` in app code.
- For tests, use the existing Vitest setup and test DB helpers under `tests/setup/`.
- Add or update tests when changing service behavior, utility logic, analytics calculations, or API behavior.
- Prefer readable, direct code over broad new abstractions.

## Avoid Changing Unless Asked

- `prisma/migrations/` - Existing migration history should not be edited.
- `prisma/schema.prisma` - Schema changes require explicit approval and matching migrations.
- `.env`, `.env.test` - Do not edit secrets or environment configuration unless asked.
- `pnpm-lock.yaml` - Avoid dependency churn unless package changes are requested.
- `package.json` - Do not change scripts or dependencies unless needed for the task.
- `.next/`, `node_modules/`, `tsconfig.tsbuildinfo` - Generated/local artifacts.
- `public/` image assets - Avoid replacing assets unless the task is visual/content-related.
- `prisma/seed.ts` - Seed data affects demos and tests; change only when requested.
- `lib/auth.ts` - Temporary auth behavior is intentional for this phase.
- Broad UI/theme files such as `app/globals.css`, `styles/tokens.css`, and `tailwind.config.ts` unless the task is styling-related.

## Notes

- This project uses `pnpm`; prefer it over `npm`, `yarn`, or `bun`.
- The README is currently generic and may not reflect the real setup requirements.
- Some scripts are diagnostic or audit tools; inspect them before running.
