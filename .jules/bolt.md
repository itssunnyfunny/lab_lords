
## 2024-03-28 - [Batch Insert Optimization in Payment Service]
**Learning:** Found an N+1 query problem where `services/payment.service.ts` loops through all students and executes `prisma.payment.create(...)` one-by-one inside a loop when generating due payments.
**Action:** Replaced the loop body with array accumulation (`paymentsToCreate.push(...)`) and executed a single `prisma.payment.createMany(...)` after the loop. This minimizes the number of database inserts significantly.

## 2024-04-01 - [Batch Insert Optimization in Branch, Onboarding and Shift Services]
**Learning:** Found N+1 query problems where `services/branch.service.ts`, `services/onboarding.service.ts` and `services/shift.service.ts` loop through arrays (shifts, seats, and seat allocations) and execute `.create(...)` and `.update(...)` one-by-one inside a loop.
**Action:** Replaced loop bodies with array mappings and `Array.from` generator, and executed single `tx.shift.createMany(...)`, `tx.seat.createMany(...)`, `tx.seatAllocation.updateMany(...)` and `tx.seatAllocation.createMany(...)`. This significantly minimizes the number of database queries during bulk actions.

## 2024-05-15 - Batched DB queries for seat allocations in shift service
**Learning:** In highly coupled multi-table models (like `Shift` vs `SeatAllocation` vs `Student`), performing item-by-item db validation inside a massive reassignment loop causes an N+1 query explosion and slows down the transaction dramatically.
**Action:** Always pre-fetch the batch required rows upfront using `id: { in: ids }`. When verifying overlaps in bulk, build an in-memory `Map` and `Set` to track assigned resources locally in the transaction, instead of relying solely on the database state, before committing the final `createMany`. Use functions like `timesOverlap` properly by mapping locally rather than blindly assigning elements.
