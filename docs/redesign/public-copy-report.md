# Public sentence preservation report — September 20, 2026

The current preview was captured before the public design rollout. After the rebuild, the same 17 routes were captured again with identical local runtime settings. The baseline is frozen; its SHA-256 is:

`12160582f90804893afef5b13121e2db8356a1c11474df4c932f4fbc673917dc`

All **39,421 normalized main-text characters**, **759 semantic blocks**, **17 page titles** and **737 control records** are unchanged. Closed FAQ answers are included. Control records include element kind, accessible label, link target and input type; their unchanged totals are 176 main, 221 header and 340 footer records.

Only the footer logo identity differs: the former crown/wordmark is replaced with the public book/leaf `LabLords.in` lockup. All footer sentences and links following that mark are identical. This exception is reported explicitly, not normalized away.

| Route | HTTP | Main characters | Semantic blocks | Copy |
| --- | --- | ---: | ---: | --- |
| `/` | 200 | 4507 | 96 | Unchanged |
| `/features` | 200 | 3027 | 84 | Unchanged |
| `/pricing` | 200 | 2126 | 47 | Unchanged |
| `/contact` | 200 | 754 | 12 | Unchanged |
| `/support` | 200 | 731 | 13 | Unchanged |
| `/privacy` | 200 | 2520 | 26 | Unchanged |
| `/terms` | 200 | 2440 | 26 | Unchanged |
| `/cookies` | 200 | 1221 | 14 | Unchanged |
| `/refund-policy` | 200 | 1493 | 16 | Unchanged |
| `/shipping-delivery-policy` | 200 | 1191 | 12 | Unchanged |
| `/software/study-hall-management` | 200 | 2720 | 59 | Unchanged |
| `/software/library-management` | 200 | 2879 | 59 | Unchanged |
| `/software/seat-management` | 200 | 2689 | 59 | Unchanged |
| `/software/student-fee-management` | 200 | 2729 | 59 | Unchanged |
| `/software/fee-reminder` | 200 | 2739 | 59 | Unchanged |
| `/software/coaching-management` | 200 | 2793 | 59 | Unchanged |
| `/software/tuition-management` | 200 | 2862 | 59 | Unchanged |

## Method and evidence

The browser audit compares complete `main.textContent` after whitespace normalization, ordered text nodes, semantic text blocks, titles and control records. Exact comparison prevents a presentation change from silently rewriting sentences. A separate TypeScript AST audit preserves 307 JSX text and non-class literal nodes across the six standalone page/template files, including their metadata, link values and templates.

Commands: `node scripts/pnpm.mjs exec node .agent/brand-rollout/copy-audit.mjs baseline` (before rollout), `node scripts/pnpm.mjs exec node .agent/brand-rollout/copy-audit.mjs after`, and `node .agent/public-rollout/check-copy.mjs`.

- [Machine-readable comparison](../../.agent/brand-rollout/copy-report.json)
- [Raw reported differences](../../.agent/brand-rollout/copy-differences.json)
- [Detailed capture method](../../.agent/brand-rollout/copy-audit.md)
- [Rollout report](public-rollout-report.md)
