# Application design pilot harness

This is an isolated, component-level browser harness for design review. It mounts the real `BranchWorkspaceShell`, `AppShell`, `BranchSidebar`, branch dashboard page, Students page, Seats page, and `CollectFeeDialog`. A Vite-only Clerk shim and in-memory `/api` adapter keep the harness independent of Clerk, PostgreSQL, Prisma, Razorpay, messaging, AI, and every external provider. It is not a production authentication bypass and does not add a Next.js route.

Every screen carries a **Synthetic design pilot** badge. Names, phone numbers, references, money, access decisions, and receipts are invented fixtures.

## Run locally

From the repository root:

The preview now serves the actual self-hosted fonts from `.next/static`. Run
`pnpm build` first if a successful local build is not available. Font assets are
loaded into memory when the preview starts; restart it after changing fonts.

```powershell
pnpm exec node tests/application-design-pilot/server.mjs
```

Open the after/pilot surfaces:

- Dashboard: <http://127.0.0.1:4187/branch/pilot?mode=after&lang=en>
- Students: <http://127.0.0.1:4187/branch/pilot/students?mode=after&lang=hi>
- Seats: <http://127.0.0.1:4187/branch/pilot/seats?mode=after&lang=hinglish>
- Partial/uncertain collection: <http://127.0.0.1:4187/branch/pilot/payments?mode=after&surface=collection&scenario=uncertain&lang=en>

Use `mode=baseline` on the same URLs for a quick theme-off comparison against the current component tree. That local toggle is useful while tuning tokens, but it is not the historical before state.

Additional query controls:

- `lang=en|hi|hinglish` selects the saved interface preference; browser locale remains `en-IN`.
- `role=owner|restricted|readonly` selects owner, permission-restricted staff, or read-only billing state.
- `state=populated|empty|error` selects the page data state. The dashboard also supports `busy|calm|loading|attendance-error|trend-error`.
- `scenario=dashboard-collection` updates dashboard figures after a confirmed synthetic partial payment.
- `scenario=uncertain` makes the first collection response fail after the in-memory record is committed; retrying uses the same idempotency key and returns the one receipt.

## Focused verification

```powershell
pnpm exec node node_modules/vitest/vitest.mjs run --config tests/application-design-pilot/vitest.config.ts
pnpm exec node node_modules/@playwright/test/cli.js test --config tests/application-design-pilot/playwright.config.ts tests/application-design-pilot/dashboard.spec.ts tests/application-design-pilot/pilot.spec.ts
```

Use these explicit configs. The unit config allowlists eight unit files and has
no database setup. Do not substitute the broad repository test command. The direct
Node entry points also avoid this Windows environment's executable-shim issue.

Current dashboard evidence and results are in
[`docs/redesign/dashboard-refinement.md`](../../docs/redesign/dashboard-refinement.md).
Its current correction screenshots and 12 actual-font JSON records cover all four viewports and
three languages plus conditional states. The new suite checks real loaded glyph
fonts, source semantics, source errors, refresh without receipt/selection loss,
late-response isolation, identity changes, keyboard controls and reduced motion.
Unimplemented preview destinations show an explicit boundary page; they do not
silently render a dashboard in place of the requested route.

The correction's final checks passed: 44 scoped unit tests and 44 dashboard browser
scenarios. The earlier combined run also passed all 34 existing pilot scenarios
(10 intentional viewport-specific skips); one timing-dependent loading test was
replaced with deterministic response gating before the clean dashboard rerun.
Four targeted collection/seat/busy-fixture scenarios passed after the final
in-memory fixture consistency adjustment.

The dedicated config covers 1440px desktop, an 834px tablet, plus 390px and 320px phones. The suite exercises both theme modes, the four representative surfaces, student search/edit/details context, seat shift/allocation interaction, partial-payment uncertainty recovery, receipt rendering, EN/HI/Hinglish, and empty/error/restricted/read-only states.

The earlier September 22 acceptance run recorded 34 passing scenarios and 10 intentional
viewport-specific skips. The compact-navigation follow-up records three passing
compact viewports and one intentional desktop skip, including an assertion that
the settings footer is inside the initial viewport. The focused theme,
navigation, localization, dashboard, and roster unit set records 10 files / 58
tests passing.

## Persistent review evidence

The approval evidence is stored at
`docs/redesign/application-design-pilot-evidence/review/`. Its baseline images
were rendered from the pinned pre-pilot source commit
`a3c6ed1337907e936a3ae2d77537ccb2e33415f0` through a temporary detached
checkout. The after images were rendered from the current branch. Both passes
used this same synthetic adapter and fixture dataset.

The set contains 53 PNGs:

| Viewport | Pinned baseline | After | Additional after states | Total |
| --- | ---: | ---: | ---: | ---: |
| desktop 1440 | 6 | 6 | failed Students, restricted Students | 14 |
| tablet 834 | 6 | 6 | — | 12 |
| mobile 390 | 6 | 6 | empty Students, read-only dashboard, Hindi navigation | 15 |
| mobile 320 | 6 | 6 | — | 12 |

Each six-image representative set contains the English dashboard, Hindi
Students, Hinglish Seats, English partial collection, English uncertain
collection, and Hindi receipt. The additional images document conditional and
small-screen states without pretending they existed in the older source tree.

Visual review covered the 320 px header and navigation, 390 px Hindi drawer and
loaded read-only dashboard, tablet Seats and collection/receipt layouts,
desktop error/restricted Students states, and the visible same-request retry on
the mobile uncertain collection. No unintended header/control overlap,
horizontal clipping, hidden primary action, or unreadable status treatment was
observed. The compact navigation keeps its own vertical scroll and its owner
return/settings footer is visible in the initial viewport.

## Capture baseline and after images

PowerShell:

```powershell
$env:PILOT_CAPTURE="1"
$env:PILOT_CAPTURE_LABEL="design-review"
pnpm run test:browser --config tests/application-design-pilot/playwright.config.ts tests/application-design-pilot/capture.spec.ts
Remove-Item Env:PILOT_CAPTURE
Remove-Item Env:PILOT_CAPTURE_LABEL
```

Images are written below `test-results/application-design-pilot/captures/<label>/<project>/`. Set `PILOT_CAPTURE_DIR` to an absolute directory to put them elsewhere. The default command captures a quick current-tree theme comparison.

For auditable historical evidence, set `PILOT_SOURCE_ROOT` to a clean checkout
of the pinned commit and `PILOT_CAPTURE_MODE=baseline` for the first pass. Then
unset `PILOT_SOURCE_ROOT`, set `PILOT_CAPTURE_MODE=after`, and run the same
command from the pilot branch. Never point the source root at a checkout with
untrusted or unrelated changes.

## Boundaries and limitations

- This is component-level synthetic evidence, not connected route, Clerk,
  database, provider, or production-data verification.
- The production components are real; authentication and `/api` are purposefully
  replaced only inside the isolated Vite harness.
- The dedicated Playwright matrix is the functional source of evidence. The
  optional agent-browser CLI was unavailable in this workspace, so it was not
  used as a second browser driver.
- Integration tests are not part of this pilot evidence because the exact
  `.env.test` database was not independently proven disposable.
