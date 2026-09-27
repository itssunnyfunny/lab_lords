# Selected application presentation

Working base: `3d58864`, clean worktree, local branch
`codex/shared-students-pattern`. This scope supersedes the historical dashboard
pilot restrictions. The selected dashboard is frozen; Students is the first
reusable record-family consumer. The owner approved its refined card comparison
on 2026-09-27 for Batch 2, Staff then Tasks. Reuse its hierarchy and shared owners;
keep Students/dashboard/public presentation frozen. Later batches remain out of scope.

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
| Compact Students identity / allocation / financial card | feature-owned `students/StudentRecordCard.tsx`, `.ui-record-card*` in `shared-ui.css` | Students and gallery import the same card; fee arithmetic, permissions and commands stay in the feature |
| Quiet initials and integrated modal language control | `Avatar tone="quiet"`, `Dialog languagePlacement="header"` | Explicit opt-ins; default avatars/modal headers stay compatible. Edit uses its scoped backdrop variant |

The frozen fixture packet is `docs/redesign/shared-system-evidence/before`.
It uses actual production components, loaded fonts, scale 1 and the fixed
September 22 fixture. The native dashboard is 1491 × 1055 after removing the
21px synthetic ribbon. This fixture is isolated from Clerk, databases and providers.
It is presentation evidence, not evidence of production authorization.

Extraction check: 3 explicit unit files / 22 tests passed; dashboard and all
eight crops have zero differing decoded pixels against the frozen baseline.
See `comparison-extracted.json`. No schema, dependencies, environment or public
copy changes are needed; the change affects authenticated presentation only.

## Reuse rules

Import from `components/ui` and `components/tables`; `Button` is the compatibility
alias of `AppButton`. Add a typed variant to an existing owner when a real consumer
needs one. Keep its default compatible. Do not introduce another button, portal,
CRUD generator, token prefix or feature service inside this layer.

```tsx
import { RecordListPage, RecordListSurface, RecordListState } from "@/components/ui/RecordList";
import { AppButton, Dialog } from "@/components/ui";
import { DataTable } from "@/components/tables/DataTable";

<RecordListPage title={t("Students")} actions={<AppButton density="compact" variant="primary" onClick={openExistingAdmission}>{t("Add student")}</AppButton>}>
  <RecordListSurface label={t("Students")} toolbar={existingFilters} footer={authorizedCount} busy={loading}>
    {loading ? <RecordListState kind="loading" title="Loading students" /> : existingAuthorizedTable}
  </RecordListSurface>
  <Dialog density="compact" open={editing} title={t("Edit student")} onClose={closeExistingEdit}>
    {existingValidatedFields}
  </Dialog>
</RecordListPage>
```

The example shows presentation slots, not a new data abstraction. Students owns
its authorization, cursor requests, fee arithmetic, scalar-response merge and
existing command/recovery components. Result loading/error transitions replace
only the result region. Keep overlays outside that conditional region; key a
workflow by its business identity, never by language. Branch/account changes
clear branch-local UI state. Do not write searches, names, phone numbers or drafts
into a URL or telemetry. Bulk consent still uses only the loaded roster selection.

`DataTable density="compact"` is explicit; its comfortable default and persisted
global density remain compatible. Small screens use the existing card renderer;
wide tables retain a named keyboard scroll region. Names and important values
wrap in Students cards. Preserve 44px touch controls, visible focus, loading,
no-results, error/retry, restricted and readonly states. Use existing reduced
motion handling; the selected theme's fast duration is a semantic token.

The refined Students card uses one surface and identity, allocation and financial
sections. Pass authorized aggregate values into the feature-owned card; undefined
financials mean unknown and `canViewPayments=false` means restricted. Known zero
due and zero paid remain separate facts. Keep every allocation's seat, shift and
bundle/component pair. The name is a labelled entry to an existing permitted
edit/details workflow; its overflow menu is separate. Do not make the container
clickable or add field boxes/full-width action footers. `.ui-record-card-actions`
enlarges only these menu triggers to 44px; desktop menus retain their composition.

`Avatar tone="quiet"` uses the existing muted surface/text tokens and does not
encode status. `Dialog languagePlacement="header"` integrates the existing
LanguageControls with wrapping, without changing portals, inertness, focus,
Escape or save behavior. Edit additionally opts into `ui-record-edit-overlay`
for less backdrop tint/blur; other consumers keep their existing backdrop.

`Dialog` / `Drawer` own inertness, focus restoration, Escape and scroll lock. The
compact detail treatment changes presentation only. They still portal to body;
the existing `html:has(workspace)` theme inheritance handles body-level overlays,
menus and toasts. Collection's explicit overlay scope remains supported wherever
it opens. Never move portals to make CSS inheritance convenient.

Use `useTranslation()` for app-owned interface strings, `useTranslation("document")`
for output, and the public URL dictionary for marketing. Preserve stored names,
notes and AI prose verbatim. Communication language and provider templates are
independent. Hindi headings use the existing Devanagari font; language switches
must keep form values and pending financial command identities.

## Gallery and safe checks

Start the existing fixture with `pnpm exec node tests/application-design-pilot/server.mjs`.
Open `http://127.0.0.1:4187/branch/pilot/gallery?mode=after&lang=en`, replacing
`en` with `hi` or `hinglish` as needed. This is a local harness path only. It imports
AppButton/AppPanel/FormField/AppSelect/Badge/RowActionsMenu/DataTable/ViewToggle,
Dialog and the exact RecordList pattern used by Students. State/density controls
and the actual `StudentRecordCard` renderer
demonstrate the components; they are not product APIs. Synthetic names and examples
never reach a database or provider. No production gallery route or auth bypass exists.

- Scoped UI/workflow units: `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/shared-system/vitest.config.ts` (explicit allowlist, throwing DB/network guard).
- Scoped fixture browsers: `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/shared-system/playwright.config.ts`.
- Final dashboard evidence: `pnpm exec node tests/application-design-pilot/system-capture.mjs after`, then `pnpm exec node tests/application-design-pilot/system-compare.mjs after`. The frozen `before` packet is never overwritten.
- Focused card refinement: `pnpm exec node tests/application-design-pilot/student-card-capture.mjs after`, then `pnpm exec node tests/application-design-pilot/student-card-compare.mjs`. The separate frozen card baseline is `docs/redesign/student-card-evidence/before`; this checks one native dashboard/table frame without regenerating historical packets.
- Palette guard: `pnpm exec node tests/shared-system/check-presentation.mjs 3d58864`.
- Connected build/test: `pnpm exec node tests/dashboard-connected/start-local.mjs build`, `... start`, `... students-test`. The existing runner proves container ID/image/loopback binding/database identity. Build additionally proves transaction read-only mode. Tests use only the existing synthetic fixture and development sessions; external business providers are held. No reset/seed/migration runs here.
- Shared changes also require lint, production build and representative existing consumers. See the exact results in the local handoff. Never run the broad database-connected repository Vitest config for a presentation change.

Palette additions belong in `styles/tokens.css`. `shared-ui.css` owns primitive
variant/pattern presentation; feature files can retain layout utilities. Existing
dashboard chart fills, matrix colors, artwork and geometry are documented
feature-specific exceptions, frozen by image comparison. The changed-file guard
flags new literal palettes and new duplicated surface styling; it is deliberately
not a whole-repository cleanup. A necessary new exception requires a reason in
this source map and targeted evidence.

See [the remaining migration batches](../redesign/page-family-migration.md).
