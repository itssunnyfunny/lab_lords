# Independent branch plans: compatibility assessment — 2026-10-28

**Independent branch plans are not implemented in the application.** The current
code still uses one organization subscription and one plan, with billable branch
quantity multiplying its price. Basic ₹99, Standard ₹299 and Pro ₹499 are the
catalogue; charging for each branch does not allow different plans in one
organization. This confirms the [October 23 cutover document](three-plan-cutover.md).

The [organization preview](../redesign/organization-branch-preview-review.md)
demonstrates the requested future model with invented records. It is not a
billing migration, an entitlement patch or evidence of working Razorpay mandates.

## Verified current ownership

| Area | Evidence and current behavior | Consequence for mixed plans |
| --- | --- | --- |
| Commercial agreement | [Prisma schema](../../prisma/schema.prisma): Organization owns current/pending subscription pointers and mutation sequence/lease. OrganizationSubscription has unique currentOrganizationId and pendingReplacementOrganizationId, one plan, price, quantity and Razorpay subscription. Branch has lifecycle billingStatus, not its own plan. | The present subscription cannot represent a ₹99 branch and a ₹499 branch simultaneously. |
| Billing projection | [BillingExperienceService](../../services/billingExperience.service.ts), getForOrganization/getForBranch: optional branch context adds identity/lifecycle status; selected plan, paid evidence, latest operation and totals come from the organization subscription. | Relabelling the real plan selector as branch-specific would misrepresent its effects. |
| Access and failure scope | [EntitlementService](../../services/entitlement.service.ts), getOrganizationProfile/assertBranchEntitlement/assertBranchWritable: branch entitlement resolves its organization; branch archival/activation checks are additional restrictions. WORKSPACE_V2 access uses trusted paid-through evidence, trial and authorized replacement grants. | Loss of organization access can make all its branches read-only. A pending branch can be blocked individually. A failed attempt does not automatically revoke access while valid paid/trial/grant evidence remains. |
| Navigation and tenancy | [UserService](../../services/user.service.ts), workspace directory; [AccessPolicy](../../services/accessPolicy.service.ts), owner or exact staff membership; [BranchWorkspaceShell](../../components/layout/BranchWorkspaceShell.tsx) and BranchAccessProvider key access by identity and branch. [OrganizationBillingContent](../../components/billing/OrganizationBillingContent.tsx) sanitizes return context. | Real tenant/branch permission boundaries and central Billing routes are reusable. Production interface selection must continue to use server effective access, not preview storage or a selected card. |
| Trials and temporary access | [OwnerTrialService](../../services/ownerTrial.service.ts) locks the owner and permits one lifetime owner trial, attached to an organization. Migrated trial claims require a never-billed organization. EntitlementService derives replacement grants from source/candidate/change evidence. | Adding a branch uses the remaining organization trial; it does not create a fresh 30 days. Current grants can affect the organization. Future branch allocation of grants needs an explicit policy, without resetting expiry or consumption. |
| Staff | [StaffInviteService](../../services/staffInvite.service.ts) requires branch staff entitlement, which resolves the organization. [Capabilities](../../lib/branchCapabilities.ts) combine permission and entitlement; exact staff membership remains branch-specific. | A Pro branch must not enable staff administration on a Basic sibling. Existing core staff permissions and downgrade behavior need preservation, not accidental deletion. |
| Analytics and AI | [AnalyticsAccessService](../../services/analyticsAccess.service.ts) gates organization reports with organization ADVANCED_ANALYTICS. [Organization aggregation](../../analytics/org.analytics.ts) then includes organization branches. [AI endpoints](../../app/api/ai/branch/[branchId]/route.ts) use aiGenerate/aiUse capabilities, whose entitlement is organization-derived. | Owner-only organization reports are not evidence of a staff tenant leak, but have no mixed-plan branch filter. Define eligible branch aggregation and apply branch effective access to AI before integration. |
| WhatsApp | [Authorization](../../services/whatsappAuthorization.service.ts) and [dispatcher](../../services/whatsappDispatcher.service.ts) check organization WHATSAPP_AUTOMATION. [Automation](../../services/whatsappAutomation.service.ts) uses assertBranchEntitlement, currently organization-derived. | Sender connection, planning, manual send, dispatch and report aggregation need branch eligibility. A shared organization sender must not confer Pro access to Basic/Standard siblings. |
| Branch lifecycle and recovery | [BranchService](../../services/branch.service.ts), create/retry/discard/reactivate/removal flows: lock organization mutations, update quantity, preserve paid mandates, and gate paid activation on replacement evidence. [BillingReplacementService](../../services/billingReplacement.service.ts) owns replacement/reconciliation. | These operations are coupled to organization quantity and leases today. Independence requires explicit branch ownership through intents, provider events, grants and reconciliation. |

Existing [branch lifecycle integration tests](../../tests/integration/services/branch-billing-lifecycle.test.ts)
cover trial duration, signed activation, quantity replacement, lost responses and
archive/undo behavior. They were inspected, not rerun against a database for this
preview task. No new provider behavior is inferred from the mock.

## Focused implementation brief — proposal, not an Accepted ADR

1. **Commercial owner:** introduce a branch commercial agreement keyed to both
   organization and branch, with billed plan, effective access, paid-through,
   trial/grant source, scheduled change, immutable history and current/pending
   provider pointers. Keep operational Student/Payment/Allocation records in place.
   A plan change must never copy or convert them.
2. **Provider mapping:** prefer one independently recoverable recurring agreement
   per branch as the design baseline. A plan-cohort subscription is an alternative
   only if it can prove independent failure/recovery and schedule boundaries.
   Confirm provider behavior in Test mode before committing to either structure.
   Current organization mandates cannot be split merely by changing quantity or
   client labels. This task does not select a provider migration strategy.
3. **Services and UI:** extend billing mutations, replacement/reconciliation,
   webhook/callback verification, invoice/history and recovery with authoritative
   branch scope. Move mutation ordering/idempotency to the correct agreement,
   retaining organization coordination where required. Project effective access
   through EntitlementService → AccessPolicy → BranchAccessProvider; keep Billing
   centralized and require an authorized branch selection on every mutation.
4. **Cutover:** inventory current agreements and unresolved operations; map each
   branch's existing paid/trial/grant rights without renewing them. Preserve old
   provider identifiers and paid evidence. Drain or reconcile pending replacements.
   Stage new authorizations at safe boundaries, prohibit duplicate charges, and
   retain a reversible rollout until provider obligations settle. Do not cancel
   a paid organization mandate before successor coverage is confirmed.
5. **Scope decisions:** define once-per-owner trial allocation, organization
   reporting of mixed plans, staff downgrade behavior and whether any deliberate
   organization-wide restriction should override branch independence. Record human
   approval as an ADR before schema/provider implementation.

Acceptance gates for that separate change:

- Paid/Pro branch A neither grants premium access nor makes unpaid/Basic B writable;
  B's failure/recovery does not revoke valid A access.
- Server authorization rejects foreign branch IDs and mismatched organization,
  agreement, callback, webhook, invoice and mutation relationships.
- Lost responses, duplicates, reordered events and stale reconciliation cannot
  apply a plan/grant/cancellation to a sibling or trigger a second charge.
- Adding, archiving, undoing and reactivating branches preserve existing paid
  rights, scheduled boundaries, trial expiry and mutation ordering.
- Staff, AI, analytics and WhatsApp enforce eligible branch scope at execution,
  including machine-dispatched work and organization aggregates.
- Student fee generation remains anniversary-based and idempotent; later monthly
  dues still generate while an earlier due remains unpaid.
- Real Test authorizations prove each price, replacement, recovery and subsequent
  plan change before release. Preview screenshots/tests cannot satisfy this gate.

No schema, seed, migration, provider state, hosting, cron or production data was
changed in this task. Vercel Pro remains intentionally deferred.

## Rechecked after main integration — 2026-10-29

The preview branch now includes merged main 22d1d09. OrganizationSubscription
and organization-derived commercial access remain the billing owners described
above. The merged complete Billing history, one-owned-organization restriction,
provider protections and retired AI Messages are retained. No schema or service
change introduces independent branch subscriptions; the proposal remains a
separate, unapproved backend migration.
