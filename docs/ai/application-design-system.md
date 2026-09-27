# Selected application presentation

Working base: `3d58864`, clean worktree, local branch
`codex/shared-students-pattern`. This scope supersedes the historical dashboard
pilot restrictions. The selected dashboard is frozen; Students is the first
reusable record-family consumer. Other page families await a focused owner review.

| Selected rule | Shared owner | Consumers / boundary |
| --- | --- | --- |
| Existing light application palette and body-portal inheritance | scoped block in `styles/tokens.css`; `application-pilot.css` for theme behavior | Existing approved routes and collection overlays; legacy root/public unchanged |
| White compact panel, 10px radius, subtle border/shadow | `AppPanel` compact density / `shared-ui.css` | Dashboard panels and Students record surface; comfortable default unchanged |
| Serif compact actions, forest primary gradient | `AppButton`, exported `appActionClassName` for real links | Dashboard navigation actions, Students header; Button remains an alias |
| Five distinct priority accents | existing `--ui-tone-*` contract, emphasis/subtle/icon/outline roles | Dashboard priority figures; existing body-status pairs retained |
| Body, heading, script and numerical font roles | existing token file; compatibility dashboard aliases | Shared variants; Devanagari handling stays at the existing language boundary |
| Dashboard chart, matrix, card counts, artwork and panel geometry | `Reference*.tsx` / `reference-dashboard.css` | Feature-specific; never turn these into generic list or chart generators |
| Record header, notices, toolbar, results and pagination | existing UI layer, record pattern | Students supplies real data/actions; no API or business logic in the pattern |
| Field validation, menus, nested overlays and focus recovery | existing FormField, RowActionsMenu, Dialog/Drawer | Keep body portals and request/component identity; no parallel overlay owner |

The frozen fixture packet is `docs/redesign/shared-system-evidence/before`.
It uses actual production components, loaded fonts, scale 1 and the fixed
September 22 fixture. The native dashboard is 1491 × 1055 after removing the
21px synthetic ribbon. This fixture is isolated from Clerk, databases and providers.
It is presentation evidence, not evidence of production authorization.

Extraction check: 3 explicit unit files / 22 tests passed; dashboard and all
eight crops have zero differing decoded pixels against the frozen baseline.
See `comparison-extracted.json`. No schema, dependencies, environment or public
copy changes are needed; the change affects authenticated presentation only.
