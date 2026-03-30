
## 2024-03-30 - N+1 Query Optimization in bulk insertions
**Learning:** In scenarios where multiple new entities need to be generated sequentially in a loop based on existing logic (e.g. catch-up payment generation), executing `await prisma.entity.create` individually inside a loop causes a significant N+1 query bottleneck.
**Action:** Always refactor sequential `create` operations into bulk operations. Collect the payloads in an array during the loop iterations and then execute a single `await prisma.entity.createMany({ data: objects })` outside the loop. This reduces database roundtrips from O(N) to O(1) and substantially improves processing time.
