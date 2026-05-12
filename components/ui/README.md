# UI System

This folder is the central home for shared product UI primitives.

## Current migration step

- Use `AppButton` for new product actions.
- Use `AppPanel` for framed operational surfaces.
- Use `PageShell` for app pages that need the standard max width, spacing, and text color.

## Design source

- Change app-level colors, fonts, radii, shadows, panel treatment, and button variants in `styles/tokens.css` first.
- Change these React primitives only when the component behavior or structure needs to evolve.
- Page code should prefer composing these primitives over repeating one-off Tailwind color and surface recipes.

Existing `Button`, `Card`, `Badge`, dialog, and menu primitives are token-backed compatibility components while pages are migrated gradually. `Button` intentionally shares the same visual language as `AppButton`.
