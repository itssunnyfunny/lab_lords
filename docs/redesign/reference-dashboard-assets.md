# Dashboard artwork and typography

All artwork is decorative; the study-space image is labelled as a generic
illustration and does not claim to depict a customer's branch. UI text, charts,
tables and controls are live elements rather than flattened screenshot panels.

## Assets

- `public/images/dashboard/study-library.png`: generated through built-in
  image_gen on 2026-09-27 using the user's selected original as visual reference.
- `public/images/dashboard/botanical-sprig.png`: generated through built-in
  image_gen on 2026-09-27, with transparent background.
- `public/fonts/dashboard/Caveat.ttf`: unmodified variable Caveat font from the
  [official Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/caveat),
  accompanied by its [SIL Open Font License](../../public/fonts/dashboard/OFL.txt).
  Self-hosted, loaded only by the scoped application treatment. Existing Inter
  and Devanagari fonts retain their established loaders. Georgia supplies the
  selected reference's compact serif hierarchy on the review machine.
- The existing owned botanical brand mark is reused. The public website is unchanged.

## Final generation prompts

Library: Use case: illustration-story. Asset for the Lab Lords application,
not a whole dashboard. Extract/recreate only the tiny warm study-library interior
illustration visible at the upper left of this reference screenshot. Show a
peaceful empty study reading room with wooden desks, dark green chairs,
bookshelves, hanging lamps, a bright window, a leafy plant, in the exact warm
softly painted realistic illustration style of the reference. A tall narrow
portrait composition, no people, no writing, no logos, no UI, no quotation.
This is a generic illustration, not a real customer's branch. Match warm cream,
wood and forest green palette.

Botanical: Use case: background-extraction. Asset: botanical illustration for
Lab Lords application UI. Recreate only a single botanical sprig closely matching
the painted green leaves on thin gently curving stems at the lower left and upper
right of the supplied reference. Transparent background. Elegant upright sprig
rising from bottom left toward upper right, about 9 long oval pointed leaves,
varying sage green, pale olive and deep forest green, subtle watercolor texture
and fine leaf veins. Natural delicate stems, calm refined editorial botanical
illustration. No text, no UI, no border, no pot, no shadows outside the sprig.
The output should be the sprig only on actual transparent background, spacious
silhouette.
