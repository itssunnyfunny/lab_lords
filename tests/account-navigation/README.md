# Account navigation verification

`pnpm exec vitest run --config tests/account-navigation/vitest.config.ts` uses an explicit unit allowlist and the shared no-external-I/O setup. It never loads the root truncating integration setup.

`local.mjs` is an opt-in local connected browser harness. It locates the original checkout from Git's common directory (or `ACCOUNT_FIXTURE_SOURCE`) and requires its existing `test-results/owner-setup/correction-runtime.json` disposable Docker proof. It verifies the exact container ID, PostgreSQL image, loopback bind and port before connecting. After a container restart, a changed port is accepted only when Docker confirms the same container has its original dynamic loopback-only binding; database names and fixture proofs remain fixed. No shared/Preview/Production database is allowed. `prepare` copies that verified synthetic fixture to a separately named database and refuses an existing proof. `seed` adds owned Basic, Standard and Pro organizations for an existing synthetic Clerk test identity; it refuses a second seed. Never run seed directly.

Commands, from the isolated worktree:

```text
pnpm exec node tests/account-navigation/local.mjs prepare
pnpm exec node tests/account-navigation/local.mjs seed
pnpm exec node tests/account-navigation/local.mjs dev
pnpm exec node tests/account-navigation/local.mjs build
pnpm exec node scripts/verify-import-workflow-manifest.mjs
pnpm exec node tests/account-navigation/local.mjs start
```

Keep the preview stopped during a build. Build uses the existing read-only target guard and Webpack because this managed worktree links node_modules outside Turbopack's filesystem root. Build/start retain real Clerk test authentication and hold billing, messaging, AI and import provider writes. `.clerk` proofs/authentication and `test-results` logs are ignored. The harness does not install keys, modify environment files or change application gates.

Browser matrix and results: [review](../../docs/redesign/unified-account-review.md).
