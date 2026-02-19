🧱 1️⃣ Execution Safety
Must Be True Before Production

AI execution happens only via backend services.

Frontend never calls Gemini directly.

All AI endpoints pass through ONE orchestrator.

aiLastCalledAt is used ONLY for execution control, not UI logic.

Edge Conditions to Verify

Opening insights page repeatedly within 5 minutes NEVER triggers Gemini again.

Opening messages page repeatedly within 5 minutes NEVER triggers Gemini again.

Two simultaneous requests cannot both execute AI (double-call protection).

⏱️ 2️⃣ Rate Limiting Behaviour

Confirm the following real-user scenarios:

Scenario A — Fresh Branch
aiLastCalledAt = null


Expected:

AI allowed

Scenario B — No Data Change
lastDataChange <= aiLastCalledAt


Expected:

Return cache
hasPendingChanges = false

Scenario C — Data Changed but Cooldown Active
lastDataChange > aiLastCalledAt
AND 5 minutes NOT passed


Expected:

Return cache
hasPendingChanges = true
nextAllowedCallAt visible

Scenario D — Cooldown Passed + New Data

Expected:

ONE AI call only

🧊 3️⃣ Cache Behaviour (Very Important)

Confirm:

Insights page loads instantly from cache when AI blocked.

Message drafts load instantly when AI blocked.

Cached report is always the latest createdAt.

Edge test:

Delete latest report manually
→ System must NOT crash.

🔄 4️⃣ Data Mutation Triggers

Verify ALL of these update Branch.lastDataChange:

Student created
Student status updated
Seat assigned/unassigned
Payment generated
Payment marked paid
Monthly fee updated


Must NOT update for:

Viewing pages
Searching/filtering
Draft creation

✉️ 5️⃣ Message Draft Lifecycle

Production expectations:

Draft created ONLY once per overdue student.

Draft removed when payment marked paid.

Draft NOT regenerated automatically.

Edge Tests:

Student becomes overdue → draft created.
Student edited but still overdue → draft stays.
Student pays → draft removed instantly.

🟡 6️⃣ Pending Changes UX

Backend must return:

hasPendingChanges
nextAllowedCallAt


Frontend must:

Show “New data available” indicator.

Show cooldown countdown.

NEVER auto-trigger AI.

⚠️ 7️⃣ Failure Handling (Teams Forget This)

Simulate Gemini failure.

Expected behaviour:

AI call fails
→ aiLastCalledAt must NOT update
→ existing cache returned
→ system remains usable


If aiLastCalledAt updates on failure → cooldown blocks users with no new insights.

🧠 8️⃣ Performance Safety

Test with:

100 overdue students


Confirm:

ONE Gemini call for drafts.

No per-student calls.

🔒 9️⃣ Logging (Minimal but Necessary)

Before production, confirm logs exist for:

AI_CALL_ALLOWED
AI_BLOCKED_RATE_LIMIT
AI_BLOCKED_NO_CHANGE
AI_CONCURRENCY_BLOCKED


This will save you hours debugging later.

🚨 10️⃣ Manual Override Behaviour

If admins manually delete drafts or reports:

System must regenerate only when user triggers AI again.


No automatic rebuild.