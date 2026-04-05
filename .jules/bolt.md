
## 2024-03-28 - [Batch Insert Optimization in Payment Service]
**Learning:** Found an N+1 query problem where `services/payment.service.ts` loops through all students and executes `prisma.payment.create(...)` one-by-one inside a loop when generating due payments.
**Action:** Replaced the loop body with array accumulation (`paymentsToCreate.push(...)`) and executed a single `prisma.payment.createMany(...)` after the loop. This minimizes the number of database inserts significantly.

## 2024-04-01 - [Batch Insert Optimization in Branch, Onboarding and Shift Services]
**Learning:** Found N+1 query problems where `services/branch.service.ts`, `services/onboarding.service.ts` and `services/shift.service.ts` loop through arrays (shifts, seats, and seat allocations) and execute `.create(...)` and `.update(...)` one-by-one inside a loop.
**Action:** Replaced loop bodies with array mappings and `Array.from` generator, and executed single `tx.shift.createMany(...)`, `tx.seat.createMany(...)`, `tx.seatAllocation.updateMany(...)` and `tx.seatAllocation.createMany(...)`. This significantly minimizes the number of database queries during bulk actions.

## 2024-04-03 - [Batch Insert Optimization in Seat Allocation Service]
**Learning:** Found an N+1 query problem in `services/seatAllocation.service.ts` where multiple seat allocations requested at once resulted in multiple `tx.seatAllocation.create(...)` database roundtrips. When batching these inserts, the loop also relied on updating internal state arrays to do conflict resolution within the same transaction.
**Action:** Replaced the loop body with array accumulation (`allocationsToCreate.push(...)`) and pushed temporary typed mock objects into the state validation array to preserve validation. Then performed a bulk `createMany` + `findMany` combo. This eliminates N inserts while returning properly typed outputs.

## 2024-04-04 - [Batch Query Optimization in Shift Service Reallocation]
**Learning:** Found a severe N+1 query bottleneck in `services/shift.service.ts` where manual shift reallocations executed up to 6 database queries sequentially inside a loop per student reassignment (including duplicate validation and seat search queries).
**Action:** Replaced loop queries by pre-fetching active allocations and seats into memory using `findMany`, tracking dynamic assignment overlap states in-memory during loop execution, and finishing with batched `createMany` and `updateMany` operations. Typed intermediate payload arrays directly using Prisma's generated types (e.g., `import("@prisma/client").Prisma.SeatAllocationCreateManyInput[]`) to avoid ESLint warnings.
