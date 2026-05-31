
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

## 2025-05-15 - [Batch Insert Optimization in Seat Allocation Service]
**Learning:** Found an N+1 query problem in `services/seatAllocation.service.ts` where multiple seat allocations requested simultaneously resulted in multiple `tx.seatAllocation.create(...)` database roundtrips wrapped in `Promise.all`. While `Promise.all` executes them in parallel, it's still N separate insert queries sent to the database.
**Action:** Replaced the `Promise.all` loop body with an array mapping to create a payload, and executed a single `tx.seatAllocation.createManyAndReturn(...)` to perform a bulk insert while natively preserving the returned records.

## 2025-05-24 - [Memory Optimization for Aggregations]
**Learning:** Found an O(N) memory and bandwidth overhead in `analytics/payment.analytics.ts` where thousands of payment rows were fetched into application memory via `findMany` just to calculate sums.
**Action:** Replaced `findMany` with Prisma's `aggregate({ _sum: { amount: true } })` to push the computation to the database, resulting in O(1) memory usage and significantly faster execution for large datasets.
## 2025-02-20 - Integration Testing Fallback for DB Connection Issues\n**Learning:** In sandbox environments, Vitest integration tests requiring a PostgreSQL connection (via
[1m[30m[46m RUN [49m[39m[22m [36mv4.1.4 [39m[90m/app[39m

[dotenv@17.2.3] injecting env (1) from .env.test -- tip: ⚙️  enable debug logging with { debug: true }
✅ Test environment loaded. DB: localhost:5432/test_db
 [31m❯[39m tests/integration/services/user.test.ts [2m([22m[2m2 tests[22m[2m | [22m[31m2 failed[39m[2m)[22m[32m 138[2mms[22m[39m
[31m     [31m×[31m updates persisted account settings[39m[32m 131[2mms[22m[39m
[31m     [31m×[31m rejects unknown or invalid account settings[39m[32m 3[2mms[22m[39m
 [31m❯[39m tests/integration/services/payment.test.ts [2m([22m[2m22 tests[22m[2m | [22m[31m22 failed[39m[2m)[22m[32m 196[2mms[22m[39m
[31m       [31m×[31m generates 1 payment for a student joined 1 month ago (time advanced by 1 month)[39m[32m 135[2mms[22m[39m
[31m       [31m×[31m is idempotent — running twice does not create duplicate payments[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m catch-up: generates multiple payments if not run for several months[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m does not generate payments for INACTIVE students[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m throws Unauthorized for non-owner[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m rejects STAFF role users from generating payments[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m DUE filter includes overdue payments (older than current month)[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m PAID filter is strict — only shows payments in the requested month[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m WAIVED filter is strict like paid payments[39m[32m 9[2mms[22m[39m
[31m       [31m×[31m monthly mixed view includes waived history records[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m allows STAFF role users to view branch payments[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m updates payment status to PAID[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m is idempotent — marking PAID twice does not throw[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m deletes FOLLOW_UP_OVERDUE_PAYMENTS message drafts when paid[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m records paymentMethod CASH with null referenceId[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m records paymentMethod UPI with txn referenceId[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m backward-compat — omitting method leaves paymentMethod null[39m[32m 1[2mms[22m[39m
[31m       [31m×[31m allows STAFF role users to mark payments paid[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m happy path — status becomes WAIVED[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m is idempotent — marking WAIVED twice does not throw[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m rejects STAFF role users from waiving payments[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m calling without status arg returns DUE but not WAIVED payments[39m[32m 1[2mms[22m[39m
 [31m❯[39m tests/integration/services/seat.test.ts [2m([22m[2m19 tests[22m[2m | [22m[31m19 failed[39m[2m)[22m[32m 172[2mms[22m[39m
[31m       [31m×[31m happy path — creates seat with correct branchId and label[39m[32m 122[2mms[22m[39m
[31m       [31m×[31m REJECTS duplicate label in same branch[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m REJECTS non-owner call[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m REJECTS STAFF role users from creating physical seats[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m REJECTS invalid seat labels[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m returns seats with their active allocations included[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m allows STAFF role users to view seat maps[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m excludes ended allocations (endDate ≠ null)[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m returns 0% when there are no allocations[39m[32m 5[2mms[22m[39m
[31m       [31m×[31m 2 shifts × 5 seats × 3 students = correct occupancy math[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m invariant: used ≤ capacity per shift even with corrupted data[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m occupied seat shows occupied: true and occupiedBy: studentName[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m all seats free → all occupied: false[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m time-overlap blocks seat — Morning alloc blocks a Full-Time query[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m seat occupied in ANY component shift → blocked in multi-shift map[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m seat free in all component shifts → available in multi-shift map[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m returns correct used, available, isFull for a fully booked shift[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m studentAlreadyAllocated: true when student has overlapping shift[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m studentAlreadyAllocated: false for non-overlapping shift[39m[32m 2[2mms[22m[39m
 [31m❯[39m tests/e2e/onboarding.test.ts [2m([22m[2m2 tests[22m[2m | [22m[31m2 failed[39m[2m)[22m[32m 159[2mms[22m[39m
[31m     [31m×[31m FLOW: Create student → Seat gets occupied → Admission payment created[39m[32m 137[2mms[22m[39m
[31m     [31m×[31m FLOW: Generate payments → Student appears overdue → Mark paid → Draft cleared[39m[32m 17[2mms[22m[39m
 [31m❯[39m tests/integration/services/student.test.ts [2m([22m[2m21 tests[22m[2m | [22m[31m21 failed[39m[2m)[22m[32m 219[2mms[22m[39m
[31m       [31m×[31m creates student with ACTIVE status[39m[32m 150[2mms[22m[39m
[31m       [31m×[31m allows STAFF role users to create students in their branch[39m[32m 5[2mms[22m[39m
[31m       [31m×[31m rejects duplicate student name and phone inside the same branch[39m[32m 4[2mms[22m[39m
[31m       [31m×[31m allows matching only one student identity field inside the same branch[39m[32m 5[2mms[22m[39m
[31m       [31m×[31m allows the same student name and phone in a different branch[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m creates admission payment if admissionFee > 0[39m[32m 4[2mms[22m[39m
[31m       [31m×[31m does NOT create admission payment if admissionFee is 0[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m uses branch defaults for monthly and admission fees[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m assigns seat+shift if seatId and shiftIds are provided[39m[32m 7[2mms[22m[39m
[31m       [31m×[31m uses the linked shift price as monthlyFee when requested[39m[32m 4[2mms[22m[39m
[31m       [31m×[31m rejects invalid profile, fee, and fee-link inputs[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m rejects updates that duplicate another student name and phone in the same branch[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m ends all active seat allocations[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m dueResolution=PAID marks DUE payments as PAID[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m dueResolution=KEEP leaves DUE payments untouched[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m dueResolution=WAIVED marks DUE payments as WAIVED[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m re-activation: INACTIVE → ACTIVE flips status back to ACTIVE[39m[32m 2[2mms[22m[39m
[31m     [31m×[31m rejects STAFF users from waiving dues while deactivating a student[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m allows STAFF role users to list students in their branch[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m includes active seat and shift details for student rows[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m shiftId filter returns only students with active allocation in that shift[39m[32m 2[2mms[22m[39m
 [31m❯[39m tests/integration/services/shift.test.ts [2m([22m[2m18 tests[22m[2m | [22m[31m18 failed[39m[2m)[22m[32m 180[2mms[22m[39m
[31m       [31m×[31m creates a shift successfully[39m[32m 128[2mms[22m[39m
[31m       [31m×[31m REJECTS if new shift time overlaps an existing active shift[39m[32m 9[2mms[22m[39m
[31m       [31m×[31m REJECTS duplicate shift name in same branch[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m REJECTS invalid required fields, time pairs, and price[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m correctly counts students in shift[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m sets isLastActiveShift=true if only 1 active shift[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m REJECTS deleting the last active shift in a branch[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m END_ALL: marks shift INACTIVE and ends all allocations[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m REALLOCATE_BULK: moves students to target shift and marks source INACTIVE[39m[32m 4[2mms[22m[39m
[31m       [31m×[31m REALLOCATE_BULK: REJECTS if target has no capacity[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m name change succeeds when no duplicate exists[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m REJECTS time change that overlaps an existing active shift[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m syncs linked student fees when price changes without rewriting existing payments[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m allows price-only edits without rechecking untouched shift times[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m moves each student per assignment map and marks source INACTIVE[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m REJECTS if target shift has no capacity for the student[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m creates Morning, Afternoon, Evening when none exist[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m is idempotent — calling twice does not duplicate shifts[39m[32m 2[2mms[22m[39m
 [31m❯[39m tests/integration/services/staff.test.ts [2m([22m[2m19 tests[22m[2m | [22m[31m19 failed[39m[2m)[22m[32m 188[2mms[22m[39m
[31m       [31m×[31m Owner is always allowed for any action[39m[32m 135[2mms[22m[39m
[31m       [31m×[31m MANAGER is allowed for manage_branch[39m[32m 8[2mms[22m[39m
[31m       [31m×[31m STAFF is denied for generate_payments[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m throws if user has no staff record on the branch[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m allows a permission override to grant STAFF access beyond role defaults[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m allows a permission override to deny MANAGER access despite role defaults[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m removes a permission override when it is reset to null[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m rejects permission updates from non-owners[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m returns effective branch access for owners and staff[39m[32m 5[2mms[22m[39m
[31m       [31m×[31m happy path — creates staff record with correct role[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m REJECTS if target user does not exist[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m REJECTS duplicate staff (same user added twice to same branch)[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m REJECTS if actor is not the owner (non-owner cannot manage staff)[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m happy path — staff record is deleted from DB[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m REJECTS if actor is not the owner[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m role change persists in the database[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m owner can list staff — returns records with user name and email[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m MANAGER can list staff (manage_branch gate allows MANAGER)[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m STAFF cannot list staff — denied by manage_branch gate[39m[32m 2[2mms[22m[39m
 [31m❯[39m tests/integration/services/seatAllocation.test.ts [2m([22m[2m13 tests[22m[2m | [22m[31m13 failed[39m[2m)[22m[32m 171[2mms[22m[39m
[31m       [31m×[31m creates allocation records for each requested shift[39m[32m 137[2mms[22m[39m
[31m       [31m×[31m allows STAFF role users to assign seats in their branch[39m[32m 4[2mms[22m[39m
[31m       [31m×[31m creates TWO allocations for morning + evening (non-overlapping)[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m REJECTS if seat is already occupied in a time-overlapping shift[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m REJECTS if student is already in an overlapping shift[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m REJECTS if requested shifts overlap each other (e.g. Morning + Full Time)[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m REJECTS INACTIVE student[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m BUG #001 — Same seat + same shift cannot be allocated twice[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m happy path — sets endDate to a non-null Date value[39m[32m 5[2mms[22m[39m
[31m       [31m×[31m double-release throws — second call rejects[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m rejects users without branch access[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m { activeOnly: true } returns only allocations with endDate === null[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m no filters returns all allocations — active and historical[39m[32m 2[2mms[22m[39m
 [31m❯[39m tests/integration/services/multiShift.test.ts [2m([22m[2m14 tests[22m[2m | [22m[31m14 failed[39m[2m)[22m[32m 176[2mms[22m[39m
[31m       [31m×[31m happy path — creates multi-shift with correct DTO shape[39m[32m 128[2mms[22m[39m
[31m       [31m×[31m REJECTS when fewer than 2 shifts are provided[39m[32m 9[2mms[22m[39m
[31m       [31m×[31m REJECTS shifts from another branch[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m REJECTS INACTIVE shifts[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m REJECTS duplicate combination (same shifts, different order)[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m REJECTS invalid name, price, and component IDs[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m updates name and price only — components unchanged[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m syncs linked student fees when bundle price changes[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m updates components — replaces old, creates new[39m[32m 5[2mms[22m[39m
[31m       [31m×[31m REJECTS duplicate combination on update[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m soft-nulls multiShiftId on existing allocations — history preserved[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m REJECTS delete by non-owner[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m returns correct DTO shape for existing multi-shifts[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m returns empty array when no multi-shifts exist[39m[32m 2[2mms[22m[39m
 [31m❯[39m tests/integration/services/organization.test.ts [2m([22m[2m12 tests[22m[2m | [22m[31m12 failed[39m[2m)[22m[32m 164[2mms[22m[39m
[31m       [31m×[31m creates org linked to the correct owner[39m[32m 125[2mms[22m[39m
[31m       [31m×[31m requires owner contact phone on create[39m[32m 9[2mms[22m[39m
[31m       [31m×[31m returns only orgs belonging to the requesting user[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m returns empty array when user has no orgs[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m returns org with branches included[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m returns null for unknown org id[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m updates org name successfully[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m REJECTS update by non-owner[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m updates persisted organization settings[39m[32m 5[2mms[22m[39m
[31m       [31m×[31m rejects invalid organization settings[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m returns true for the actual owner[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m returns false for a stranger[39m[32m 2[2mms[22m[39m
 [31m❯[39m tests/integration/services/branch.test.ts [2m([22m[2m13 tests[22m[2m | [22m[31m13 failed[39m[2m)[22m[32m 165[2mms[22m[39m
[31m       [31m×[31m creates branch linked to correct org[39m[32m 128[2mms[22m[39m
[31m       [31m×[31m creates default shifts (Morning, Afternoon, Evening, Full Time) when none supplied[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m creates the correct number of seats when seatCount supplied[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m adds calling user as MANAGER on the new branch[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m rejects branch creation for an organization the user does not own[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m rejects invalid branch creation fields[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m returns null for an unknown id[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m returns branch for a valid id[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m allows staff with payment access to read branch metadata without staff records[39m[32m 4[2mms[22m[39m
[31m       [31m×[31m updates branch settings for the organization owner[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m allows branch managers to update branch settings[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m rejects staff without manage_branch permission[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m rejects invalid branch settings[39m[32m 2[2mms[22m[39m
 [31m❯[39m tests/integration/analytics/payment.analytics.test.ts [2m([22m[2m8 tests[22m[2m | [22m[31m8 failed[39m[2m)[22m[32m 189[2mms[22m[39m
[31m       [31m×[31m separates monthly revenue, monthly collected, and all due correctly[39m[32m 165[2mms[22m[39m
[31m       [31m×[31m keeps analytics, overdue list, and AI payment snapshot on the same ledger[39m[32m 4[2mms[22m[39m
[31m       [31m×[31m uses overdue counts, not due counts, in organization AI snapshots[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m uses shift-slot occupancy instead of distinct-seat occupancy[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m rolls up seat utilization from slots instead of distinct physical seats[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m rejects users without analytics access[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m returns slot-based utilization counts for branch cards[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m accepts period=month for authorized owners[39m[32m 2[2mms[22m[39m
 [31m❯[39m tests/integration/services/onboarding.test.ts [2m([22m[2m7 tests[22m[2m | [22m[31m7 failed[39m[2m)[22m[32m 159[2mms[22m[39m
[31m       [31m×[31m creates org and branch atomically — correct ownership chain[39m[32m 130[2mms[22m[39m
[31m       [31m×[31m requires an owner phone[39m[32m 10[2mms[22m[39m
[31m       [31m×[31m creates default shifts on the new branch[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m creates correct number of seats when seatCount is supplied[39m[32m 4[2mms[22m[39m
[31m       [31m×[31m adds the user as MANAGER on the new branch[39m[32m 3[2mms[22m[39m
[31m       [31m×[31m calling twice creates 2 separate networks — no dedup (expected contract)[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m creates custom shifts when shifts array is supplied[39m[32m 2[2mms[22m[39m
 [31m❯[39m tests/integration/services/staffInvite.test.ts [2m([22m[2m7 tests[22m[2m | [22m[31m7 failed[39m[2m)[22m[32m 168[2mms[22m[39m
[31m       [31m×[31m creates a one-use invite token for the branch owner[39m[32m 128[2mms[22m[39m
[31m       [31m×[31m rejects branch managers because staff invites are owner-only[39m[32m 10[2mms[22m[39m
[31m       [31m×[31m lists only active pending invites for the owner[39m[32m 12[2mms[22m[39m
[31m       [31m×[31m expires a pending invite so it can no longer be accepted[39m[32m 7[2mms[22m[39m
[31m       [31m×[31m creates the staff membership and marks the invite accepted[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m rejects expired invites[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m does not overwrite an existing staff role when accepting another invite[39m[32m 2[2mms[22m[39m
 [32m✓[39m tests/unit/importing/import-parsing-validation.test.ts [2m([22m[2m12 tests[22m[2m)[22m[33m 547[2mms[22m[39m
     [33m[2m✓[22m[39m parses the first XLSX sheet [33m 309[2mms[22m[39m
 [32m✓[39m tests/unit/importing/import-commit.service.test.ts [2m([22m[2m6 tests[22m[2m)[22m[33m 1509[2mms[22m[39m
     [33m[2m✓[22m[39m does not run when the session is not READY_TO_COMMIT [33m 1496[2mms[22m[39m
 [32m✓[39m tests/unit/lib/branchNotifications.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 41[2mms[22m[39m
 [32m✓[39m tests/unit/api/import-sessions.route.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 84[2mms[22m[39m
 [32m✓[39m tests/unit/api/branches.route.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 101[2mms[22m[39m
 [32m✓[39m tests/unit/api/payment-audit-log.route.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 29[2mms[22m[39m
 [32m✓[39m tests/unit/lib/rateLimit.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 34[2mms[22m[39m
 [32m✓[39m tests/unit/services/staff.test.ts [2m([22m[2m21 tests[22m[2m)[22m[32m 21[2mms[22m[39m
 [32m✓[39m tests/unit/utils/shiftTime.test.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 15[2mms[22m[39m
 [32m✓[39m tests/unit/lib/branchPageAccess.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32m✓[39m tests/unit/lib/topSearch.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 11[2mms[22m[39m
 [32m✓[39m tests/unit/lib/formValidation.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 12[2mms[22m[39m
 [32m✓[39m tests/unit/lib/auth.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 14[2mms[22m[39m
 [32m✓[39m tests/unit/lib/paymentStatus.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32m✓[39m tests/unit/lib/permissionMessages.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 5[2mms[22m[39m
 [32m✓[39m tests/unit/lib/safeRedirect.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 5[2mms[22m[39m

[2m Test Files [22m [1m[31m14 failed[39m[22m[2m | [22m[1m[32m16 passed[39m[22m[90m (30)[39m
[2m      Tests [22m [1m[31m177 failed[39m[22m[2m | [22m[1m[32m101 passed[39m[22m[90m (278)[39m
[2m   Start at [22m 07:07:08
[2m   Duration [22m 33.56s[2m (transform 1.17s, setup 0ms, import 11.12s, tests 4.89s, environment 5ms)[22m) might fail with  if the database service isn't reachable.\n**Action:** If integration tests cannot be fully executed locally due to an unreachable database, verify code correctness by running
> lab_lords@0.1.0 build /app
> next build

▲ Next.js 16.2.5 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 14.2s
  Running TypeScript ...
  Finished TypeScript in 19.3s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/18) ...
  Generating static pages using 3 workers (4/18)
  Generating static pages using 3 workers (8/18)
  Generating static pages using 3 workers (13/18)
✓ Generating static pages using 3 workers (18/18) in 566ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /account
├ ƒ /api/ai/branch/[branchId]
├ ƒ /api/ai/branch/[branchId]/messages
├ ƒ /api/analytics/branch/[branchId]/snapshot
├ ƒ /api/analytics/branch/[branchId]/trends
├ ƒ /api/analytics/org/[orgId]/snapshot
├ ƒ /api/analytics/org/[orgId]/trends
├ ƒ /api/branches
├ ƒ /api/branches/[branchId]
├ ƒ /api/branches/[branchId]/access
├ ƒ /api/branches/[branchId]/import-sessions
├ ƒ /api/branches/[branchId]/import-sessions/[sessionId]
├ ƒ /api/branches/[branchId]/import-sessions/[sessionId]/analyze
├ ƒ /api/branches/[branchId]/import-sessions/[sessionId]/commit
├ ƒ /api/branches/[branchId]/import-sessions/[sessionId]/mapping
├ ƒ /api/branches/[branchId]/import-sessions/[sessionId]/preview
├ ƒ /api/branches/[branchId]/import-sessions/[sessionId]/questions
├ ƒ /api/branches/[branchId]/import-sessions/[sessionId]/rows
├ ƒ /api/branches/[branchId]/multi-shifts
├ ƒ /api/branches/[branchId]/multi-shifts/[multiShiftId]
├ ƒ /api/branches/[branchId]/multi-shifts/[multiShiftId]/seat-map
├ ƒ /api/branches/[branchId]/payments
├ ƒ /api/branches/[branchId]/payments/generate
├ ƒ /api/branches/[branchId]/payments/overdue
├ ƒ /api/branches/[branchId]/seat-allocations
├ ƒ /api/branches/[branchId]/seats
├ ƒ /api/branches/[branchId]/shifts
├ ƒ /api/branches/[branchId]/shifts/[shiftId]
├ ƒ /api/branches/[branchId]/shifts/[shiftId]/analyze
├ ƒ /api/branches/[branchId]/shifts/[shiftId]/seat-map
├ ƒ /api/branches/[branchId]/shifts/capacity
├ ƒ /api/branches/[branchId]/staff
├ ƒ /api/branches/[branchId]/staff-invites
├ ƒ /api/branches/[branchId]/staff-invites/[inviteId]
├ ƒ /api/branches/[branchId]/staff/[staffId]
├ ƒ /api/branches/[branchId]/students
├ ƒ /api/onboarding
├ ƒ /api/organizations
├ ƒ /api/organizations/[orgId]
├ ƒ /api/organizations/[orgId]/branches
├ ƒ /api/payments/[paymentId]/audit-log
├ ƒ /api/payments/[paymentId]/pay
├ ƒ /api/payments/[paymentId]/waive
├ ƒ /api/seat-allocations
├ ƒ /api/seat-allocations/[allocationId]
├ ƒ /api/seat-allocations/[allocationId]/end
├ ƒ /api/students/[studentId]/status
├ ƒ /api/users/me
├ ƒ /branch/[branchId]
├ ƒ /branch/[branchId]/ai/insights
├ ƒ /branch/[branchId]/ai/messages
├ ƒ /branch/[branchId]/ai/reports
├ ƒ /branch/[branchId]/allocations
├ ƒ /branch/[branchId]/analytics
├ ƒ /branch/[branchId]/onboarding/import
├ ƒ /branch/[branchId]/onboarding/import/[sessionId]
├ ƒ /branch/[branchId]/overdue
├ ƒ /branch/[branchId]/payments
├ ƒ /branch/[branchId]/seats
├ ƒ /branch/[branchId]/settings
├ ƒ /branch/[branchId]/shifts
├ ƒ /branch/[branchId]/staff
├ ƒ /branch/[branchId]/students
├ ○ /cookies
├ ○ /icon.png
├ ƒ /invite/[token]
├ ○ /onboarding
├ ○ /org
├ ƒ /org/[orgId]
├ ƒ /org/[orgId]/analytics
├ ƒ /org/[orgId]/settings
├ ○ /privacy
├ ○ /robots.txt
├ ƒ /sign-in/[[...sign-in]]
├ ƒ /sign-up/[[...sign-up]]
├ ○ /sitemap.xml
├ ○ /support
└ ○ /terms


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand to confirm no TypeScript or compilation regressions were introduced, alongside syntax checks with .
## 2025-02-20 - Integration Testing Fallback for DB Connection Issues
**Learning:** In sandbox environments, Vitest integration tests requiring a PostgreSQL connection (via `npx cross-env DATABASE_URL=... vitest run`) might fail with `P1001: Can't reach database server` if the database service isn't reachable.
**Action:** If integration tests cannot be fully executed locally due to an unreachable database, verify code correctness by running `pnpm build` to confirm no TypeScript or compilation regressions were introduced, alongside syntax checks with `node --experimental-strip-types --check file`.
