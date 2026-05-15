
## 2024-03-28 - [Batch Insert Optimization in Payment Service]
**Learning:** Found an N+1 query problem where `services/payment.service.ts` loops through all students and executes `prisma.payment.create(...)` one-by-one inside a loop when generating due payments.
**Action:** Replaced the loop body with array accumulation (`paymentsToCreate.push(...)`) and executed a single `prisma.payment.createMany(...)` after the loop. This minimizes the number of database inserts significantly.

## 2024-04-01 - [Batch Insert Optimization in Branch, Onboarding and Shift Services]
**Learning:** Found N+1 query problems where `services/branch.service.ts`, `services/onboarding.service.ts` and `services/shift.service.ts` loop through arrays (shifts, seats, and seat allocations) and execute `.create(...)` and `.update(...)` one-by-one inside a loop.
**Action:** Replaced loop bodies with array mappings and `Array.from` generator, and executed single `tx.shift.createMany(...)`, `tx.seat.createMany(...)`, `tx.seatAllocation.updateMany(...)` and `tx.seatAllocation.createMany(...)`. This significantly minimizes the number of database queries during bulk actions.

## 2024-04-03 - [Batch Insert Optimization in Seat Allocation Service]
**Learning:** Found an N+1 query problem in `services/seatAllocation.service.ts` where multiple seat allocations requested at once resulted in multiple `tx.seatAllocation.create(...)` database roundtrips. When batching these inserts, the loop also relied on updating internal state arrays to do conflict resolution within the same transaction.
**Action:** Replaced the loop body with array accumulation (`allocationsToCreate.push(...)`) and pushed temporary typed mock objects into the state validation array to preserve validation. Then performed a bulk `createMany` + `findMany` combo. This eliminates N inserts while returning properly typed outputs.

## 2025-04-23 - [Batch Insert Optimization for Manual Shift Deletion]
**Learning:** Found an N+1 query problem in \`services/shift.service.ts\` within \`ShiftService.deleteShift\`'s \`REALLOCATE_MANUAL\` handler where it sequentially queries and updates the database multiple times inside a loop for each shifted student.
**Action:** Replaced the loop body queries with bulk pre-fetches (fetching old allocations, relevant active student allocations, all seats, and active branch allocations). Converted the inner sequential \`create\` and \`update\` calls into array accumulation (pushed into \`newAllocationsToCreate\`) while managing state locally via mock array injections, followed by an \`updateMany\` and \`createMany\` after the loop.

## 2024-05-14 - [Batch Insert Optimization in updateAllocation using createManyAndReturn]
**Learning:** Found a performance bottleneck in `services/seatAllocation.service.ts` where updating allocations executed multiple `tx.seatAllocation.create` calls wrapped in a `Promise.all`. While parallelized at the JS level, this still issues multiple database INSERT statements (N+1 inserts).
**Action:** Replaced the `Promise.all` + `.map` + `.create` pattern with a single `tx.seatAllocation.createManyAndReturn` batch operation. This executes a single bulk INSERT query while still returning the newly created records, reducing DB roundtrips and resolving the N+1 bottleneck.
