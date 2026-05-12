# UI System

This folder is the central home for shared product UI primitives.

## Current migration step

- Use `AppButton` for new product actions.
- Use `AppPanel` for framed operational surfaces.
- Use `PageShell` for app pages that need the standard max width, spacing, and text color.
- Use `formSurface.ts` helpers for dialog shells, labels, inputs, checkboxes, inline errors, and form sub-surfaces.
- Use `pageSurface.ts` helpers for page loading/error states, page hierarchy text, list cards, metric insets, filter shells, empty states, dividers, and custom tables.
- Use `chromeSurface.ts` helpers for app shell, sidebar, header, search, notifications, and branch chrome surfaces.
- Use `entrySurface.ts` helpers for auth, invite, workspace picker, and other standalone entry pages.

## Design source

- Change app-level colors, fonts, radii, shadows, panel treatment, and button variants in `styles/tokens.css` first.
- Change these React primitives only when the component behavior or structure needs to evolve.
- Page code should prefer composing these primitives over repeating one-off Tailwind color and surface recipes.

Existing `Button`, `Card`, `Badge`, dialog, and menu primitives are token-backed compatibility components while pages are migrated gradually. `Button` intentionally shares the same visual language as `AppButton`.
Form-heavy pages and dialogs should compose `formSurface.ts` helpers so app-wide form tone can be changed from the token file instead of editing every page.
Page-level list and table experiences should compose `pageSurface.ts` helpers when a dedicated primitive like `AppPanel` or `DataTable` does not fit the local structure.
App-level navigation, branch search, notification popovers, and persistent chrome should compose `chromeSurface.ts` so chrome contrast and density can evolve independently from page content.
Standalone entry flows should compose `entrySurface.ts` so auth, invite, and workspace selection screens stay aligned without copying one-off shell styles.
