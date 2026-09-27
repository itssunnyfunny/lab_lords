# Original dashboard implementation

Local work authorized 2026-09-27. The user's selected original supersedes the
earlier pilot reductions; final visual acceptance remains with the owner.
Base: `d190002`, clean worktree. Working branch: `codex/reference-dashboard`.
No push, deployment, public-site change or shared database operation is in scope.

## Reference and plan

Original: `lablords_library_dashboard_overview.png`, 1491 × 1055 pixels (PNG header verified).
Desktop geometry: sidebar 230px; topbar 64px; content starts x247; heading
150px; Action Center 190px; summary 106px; lower grid roughly 45/31/24 percent.
Compare at native width and device scale 1, with fixture label accounted for.

| Reference element | Existing implementation/data | Missing capability | Planned change | Validation |
| --- | --- | --- | --- | --- |
| Shell and header | Scoped switcher/search, language/account, narrow sidebar | Shortcut, artwork, persistent notices, new navigation | Retain controls; restore illustrated header and complete navigation | Keyboard, route and responsive screenshots |
| Five priorities | Overdue and fee-date priorities | Scheduled follow-ups, explicit expectations, utilization threshold, membership terms | Permission-shaped aggregate; conservative unconfigured defaults | Cross-tenant, role, empty/error and date-boundary checks |
| Six metrics | Four cards and analytics | Consistent follow-up/dues totals | Shared aggregate with exact financial meanings | Aggregate consistency and partial-balance checks |
| Collections chart | Daily collection-only bars | Month/cohort aggregates | Narrow bars, genuine cumulative line, range and summary | Independent money axes; no fabricated historical points |
| Attendance/seating | Current shift capacity | Prospective dated snapshots and interactive matrix | Today/week/map tabs and cell details | Full denominator, missing-history and explicit attendance checks |
| Activity and actions | Partial bounded source feed; two shortcuts | Full source events and six actions | Authorized feed and compact two-column actions | Actual destinations, recorded timestamps |
| Worklists | Renewal fee queue and overdue table | Membership terms, focused follow-ups/tasks/exports | Working scoped destinations, CSV safety | Persisted edits and provider-held connected checks |

## Preserved boundaries

Financial totals derive from recorded fees, allocations and non-void collections;
membership terms never change anniversary fee generation or student status.
Attendance expectations are explicit and never auto-mark absence. Tenant scope,
permissions, entitlement/writability and generic child-not-found responses apply
server-side. Language changes preserve component and request identities. Existing
collection recovery/receipt and supervised QR workflows remain canonical.

## Verification plan

Use explicit no-database unit configuration; inspect and verify a newly created
loopback disposable database before migrations or integration setup. Exercise real
Next routes using development authentication, with providers held. Capture native
desktop and component crops, tablet and 320/390px mobile in all three languages.
Run scoped regressions, lint, build, workflow manifest and whitespace checks.
Record exact commands, outcomes, migration counts, coverage limits and commit log.

No marketing change needed: this is authorized local application work. Home,
Features, Pricing, FAQ, translated public URLs and metadata remain unchanged.
