# Commercial execution contracts

Active billing is scoped to the owner's selected branch agreement.
[Branch billing operations](../billing/independent-branch-rollout.md) covers
migration, recovery and release.

| Surface | Execution and retained purpose |
| --- | --- |
| New organization and first branch | Onboarding atomically creates BRANCH_V3, the agreement, future selection, eligible trial and setup receipt. |
| Additional branch | The owner supplies its future plan. An existing owner trial retains its tier and expiry. A branch outside the trial requires its own activation. |
| Plan, cancellation and recovery | Account Billing resolves the branch agreement before admitting or resuming its operation. The mandate quantity is one. |
| Historical identity | Original aggregate mandates, invoices and settlements retain their original identifiers, tenant and provider mode. |
| Historical maintenance | The retired workspace-promotion command exits before opening a database. Scoped investigation can verify original aggregate evidence. |

| Provider action | Durable owner/intent before common dispatch | Evidence/finalization |
| --- | --- | --- |
| Initial create | Initial provisioning immutable tuple + branch agreement lease; purpose CREATE | Exact discovery/current read, initial finalizer |
| Replacement create | Replacement version-2 tuple + processing attempt/lease; CREATE | Exact discovery/binding and replacement finalizer |
| Branch plan or cancellation | BillingMutation enqueue + immutable commercial intent/attempt/lease; MUTATE | Exact mutation expectation, paid evidence or scheduled state |
| Scheduled undo | Claimed scheduled undo and fresh pending-state checks; UNDO_SCHEDULE | Exact undo finalizer |
| Candidate cancellation | Candidate slot/cleanup intent and attempt/lease; CANCEL_CANDIDATE | Terminal candidate identity and slot finalizer |
| Source cancellation | Healthy viable replacement, exact boundary/source identity, independent admission; CANCEL_SOURCE | Source-specific confirmed response or terminal source read; candidate evidence cannot resolve it |
| Initial authorization expiry | Existing scoped subscription + expiry checks + branch agreement lease; EXPIRE_INITIAL | Terminal provider identity and ownership-checked local expiry |

Provider subscription mutations dispatch through `executeBillingProviderAction`. Its key is
operation identity plus purpose, and its request/hash/mode/identity are immutable
in PostgreSQL. Each action commits ADMITTED before external I/O. ADMITTED/UNKNOWN
cannot be taken over or replayed because time elapsed or a new client key arrived.
A definitely rejected request can retry the identical intent. CONFIRMED stores
the provider response independently of domain finalization; it does not grant
paid access. Domain reconcilers acknowledge only their exact action after their
existing provider-evidence and ownership checks. Uncertain actions block other
dispatch for the affected agreement. No database transaction spans the provider call.

`getRazorpayClient` excludes subscription mutation methods; the mutation factory
is restricted to the executor by an AST architecture test. Plan-catalog creation
retains its separate durable global catalog protocol and a narrowed catalog
client; creating a plan is not changing an organization's subscription. The
read-only methods preflight and application HTTP helpers are explicit test
exceptions, not provider dispatch paths.

Reviewed official [create](https://razorpay.com/docs/api/payments/subscriptions/create-subscription/),
[update](https://razorpay.com/docs/api/payments/subscriptions/update-subscription/)
and [scheduled-update undo](https://razorpay.com/docs/api/payments/subscriptions/cancel-update/)
documentation. Request shapes and provider lifecycle policy are unchanged. No
provider-native subscription idempotency guarantee is assumed.

Review unresolved historical provider obligations against their original
records, account, provider mode, frozen terms and captured payment evidence.
Retain these records across branch initialization and any forward repair.
