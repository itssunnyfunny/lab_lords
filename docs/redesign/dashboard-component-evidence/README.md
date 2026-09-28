# Dashboard component comparison — 2026-09-25

The source is the owner's original **1491 × 1055** PNG. `target/` contains
uncropped-resolution panel excerpts from that file. `render/` contains locator
screenshots of the fixed, synthetic busy library at a **1440 × 1024** Chromium
viewport, device scale 1, browser zoom 100%, after fonts and two paint frames
settled. The synthetic 21px preview ribbon is excluded from every component
crop and subtracted from app-position measurements in `geometry.json`.

Each `pairs/` image shows the target excerpt uniformly displayed at
1440/1491 scale beside the browser's 1:1 CSS-pixel crop. Thus padding, height,
type, borders, fills, controls, alignment and density can be reviewed at a
consistent width; it is not a pixel-diff score. Target values and names are
illustrative, while the render uses one coherent fixed fixture.

| Component | Target displayed | Current render | Comparison |
| --- | ---: | ---: | --- |
| Action Center | 1179 × 184 | 1164 × 155 | [Open pair](pairs/action-center.png) |
| Summary | 1179 × 102 | 1164 × 104 | [Open pair](pairs/summary.png) |
| Collections | 536 × 313 | 525 × 340 | [Open pair](pairs/collections.png) |
| Seating | 355 × 313 | 354 × 336 | [Open pair](pairs/seating.png) |
| Activity | 269 × 251 | 263 × 254 | [Open pair](pairs/activity.png) |
| Quick Actions | 269 × 163 | 263 × 93 | [Open pair](pairs/quick-actions.png) |
| Upcoming fees | 461 × 172 | 439 × 220 | [Open pair](pairs/upcoming.png) |
| Follow-ups | 431 × 172 | 440 × 223 | [Open pair](pairs/follow-ups.png) |

The smaller Action Center, four-card summary and two-action Quick Actions
panel are deliberate low-count compositions. Collections is taller because it
shows a real 14-day single series, independent billed/collected/outstanding
facts and an accessible breakdown; the target's stack and rate line are not
supported. Seating uses **current per-shift allocation tiles**, not the
target's unrecorded weekday history. Upcoming and Follow-ups are taller because
the fixture has four real rows, the fee meanings differ from the illustration,
and Follow-ups retains selection, exact-payment and full-queue actions.
Activity has only the three genuinely recorded event types and actual times.
No photo or quotation block was restored.

Regenerate with the isolated pilot server and the scoped Playwright capture,
then `node tests/application-design-pilot/compare-dashboard-components.mjs
<path-to-original-target.png>`. Neither command reads a database or provider.
