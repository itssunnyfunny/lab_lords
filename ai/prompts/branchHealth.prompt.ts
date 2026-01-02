import { AIBranchSnapshot } from "../contracts/branch.contract"

export function branchHealthPrompt(input: AIBranchSnapshot): string {
  return `
You are helping the owner of a study hall understand the current health of their branch.

Use ONLY the information below.
Do NOT invent data.
Do NOT suggest automation or software actions.
Do NOT mention analytics, systems, or dashboards.

Branch:
- Name: ${input.branchName}

Seats:
- Total seats: ${input.seats.total}
- Occupied seats: ${input.seats.occupied}
- Available seats: ${input.seats.available}
- Seat utilization: ${input.seats.utilizationPercent}%

Students:
- Total students: ${input.students.total}
- Active students: ${input.students.active}
- Inactive students: ${input.students.inactive}

Payments:
- Paid payments: ${input.payments.paidCount}
- Due payments: ${input.payments.dueCount}
- Overdue payments: ${input.payments.overdueCount}

As of: ${input.asOf.toDateString()}

Your tasks:
1. Write a short summary of the branch health (2–3 lines).
2. List any risks or concerns, if present.
3. Suggest practical actions the owner can take manually.

Tone:
- Simple
- Practical
- Non-technical
- Respectful
`;
}
