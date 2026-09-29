# LEAD-01 — durable onboarding replay proposal

Status: **proposed; schema/migration approval required before implementation**. This is not an Accepted ADR or a release instruction. The current `POST /api/onboarding` creates a fresh organization and branch on every valid call. A lost response after commit followed by Retry creates a second workspace; the lifetime owner-trial uniqueness guard prevents a second trial but cannot identify the original command. Intentional additional workspaces remain supported.

## Smallest durable change

Add one `OnboardingRequest` receipt table in a new additive migration. The receipt has `(ownerId, idempotencyKey)` as its compound primary key, a versioned `requestHash` of the canonical validated setup payload, `organizationId`, `branchId`, and `createdAt`. Reference the owner and organization by ID and the result branch by the existing `(id, organizationId)` composite key. Do not store the request body, phone, payment state or provider data. Existing organizations need no backfill. No package or environment value changes are proposed.

The request key is a new UUID for each intentional setup. The API requires it before any write. In the existing creation transaction, lock the authenticated User, look up that owner's receipt, and compare the canonical hash. A matching replay rechecks exact current owner/organization/branch linkage and returns the original result IDs without rerunning setup, trial or billing logic. Reusing a key with changed input returns `409`; a foreign or mismatched result gets the generic tenant-safe error. A new key runs the existing creation path and inserts its receipt in the **same** transaction. Trial uniqueness and deliberate second-workspace behavior stay unchanged.

The browser freezes the validated request plus key **before** dispatch and retains them across an uncertain response and reload, scoped to the signed-in account. Retry reuses that pair; editing a pending request cannot silently create another key. An explicit new-setup action starts a fresh pair after the previous outcome is known. If durable browser storage is unavailable, creation must not proceed without another durable recovery mechanism. The onboarding request helper must preserve definite HTTP status/code so a conflict is not mistaken for an uncertain network result.

## Compatibility, validation and rollback

Deploy the additive receipt table before the receipt-aware API/client. During mixed-client rollout, the new API rejects requests lacking a key before writes. Historical uncertain requests cannot be safely matched or backfilled. No current schema or migration file is rewritten, and no shared database will be touched in this task without separate authorization.

On an exact verified disposable PostgreSQL target, test lost response after commit and browser reload, concurrent same-key calls, a changed body under one key, two intentional keys, cross-owner reuse, foreign/missing receipt links, transaction failure before commit, and replay after settings/trial/billing changes. Assert one original network/result and one lifetime trial, no provider call or replay mutation, and tenant-safe responses. A mocked service or disabled button alone does not close LEAD-01.

Rollback must preserve the receipt table and replay-aware handler, or hold onboarding creation with its existing gate. Rolling back to the current identity-free handler would restore duplicate-creation risk. Any deployed migration/release plan needs owner review of that compatibility constraint before execution.
