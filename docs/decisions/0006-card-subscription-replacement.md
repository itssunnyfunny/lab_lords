# 0006: Fresh authorization for card subscription changes

- Status: Proposed
- Date: 2026-10-22
- Deciders: Pending
- Supersedes: None
- Superseded by: None

## Context

Actual Razorpay Test checkout succeeded, but a subsequent Standard-to-Basic
update was rejected because domestic-card subscriptions permit only linked
offer updates. Razorpay's [update guide](https://razorpay.com/docs/payments/subscriptions/update)
documents this restriction. The stored `CARD` method does not identify a
domestic or international card, so it cannot establish in-place eligibility.

The application already has a replacement-mandate protocol for UPI/eMandate:
frozen commercial intent, a separate authorized candidate, a safe cycle boundary,
durable cancellation actions, and paid-evidence requirements for promotion.

## Proposed decision

Route new CARD plan and quantity changes through that protocol. Keep the source
method `CARD`; require fresh customer authorization. Permit card-only replacement
when the existing multi-method rollout flag is off, without exposing additional
payment methods or proactive payment-method switching. Preserve historical
native-action receipts and their recovery/undo paths; never reinterpret an
already-admitted command as a new replacement.

Preserve existing prices, paid-through periods, trial dates, safe-cycle timing,
and complimentary replacement-access policy. For an unpaid future-start source,
hold replacement when the first charge is too close. Retire it only after exact
candidate authorization and fresh proof of unchanged terms, the same future
start, explicit zero paid count and complete empty invoice history. Promotion
still requires exact candidate payment evidence and a terminal source.

This implementation is on the isolated billing branch for review. This document
does not claim human approval or deployment.

## Alternatives considered

- Keep direct CARD updates: reproduces the observed domestic-card rejection.
- Infer geography from a payment-method label: lacks authoritative evidence.
- Persist verified card provenance and permit international native updates:
  requires a new evidence contract and possibly schema changes; deferred.

## Consequences and security

Card customers must authorize plan/quantity changes again, including eligible
international cards. Existing replacement timing and disclosures apply. Source
access remains supported by its original evidence; candidates cannot become
the paid canonical subscription from authorization alone. Tenant ownership,
mode isolation, signatures, commercial terms, leases, FIFO holds, and durable
provider-action idempotency remain required. No schema or environment changes
are introduced.

## Rollout and rollback

Review the [audit](../audits/billing-recovery-2026-10-22.md) and complete the
applicable Test acceptance checks before release. The existing billing-write
hold can contain mutations. Retain all candidate, source, payment and action
records on rollback. Do not restore an implementation that replays uncertain
actions or sends new unsupported domestic-card updates; prefer a compatible
forward repair.

## Evidence and approval

- [Replacement policy](../../services/billingReplacementPolicy.ts)
- [Replacement service](../../services/billingReplacement.service.ts)
- [Billing integration regressions](../../tests/integration/services/billing-mutation.test.ts)
- [Runbook](../production-runbook.md)

Human approval: pending. No approval is inferred from this implementation.
