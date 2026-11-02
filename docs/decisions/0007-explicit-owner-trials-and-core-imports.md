# Explicit owner trials and core spreadsheet import

- Status: Proposed
- Date: 2026-11-02
- Deciders: Human ADR approval not recorded
- Supersedes: None

## Context

The 2 November onboarding request explicitly asks for a real choice of Basic,
Standard or Pro trial, spreadsheet import in every plan, and preservation of
historical trials, paid commitments, tenant boundaries and retry safety. The
previous implementation grants Standard independently of the post-trial card
and treats import as a full-workspace capability. This draft records the
requested implementation; it does not invent an Accepted policy decision or
authorize release.

## Decision under review

Persist `trialPlan` on the existing once-per-owner grant. Default historical
grants to Standard without using the organization's post-trial preference.
Retain V1 receipt hashes and use a V2 hash when an explicit trial tier is sent.
Creation, grant and receipt remain one owner-locked transaction. Tier changes
before dispatch are ordinary draft edits; replay or post-creation billing
choices cannot issue another trial or reset its end date.

Resolve access from the grant tier, preserving any higher independently trusted
paid period and existing replacement policy. A card choice is neither a paid
subscription nor permission for a provider write. Pro WhatsApp still needs its
own setup, availability, provider, template, consent and usage gates.

Make `importView` and `importStudents` core capabilities, keeping students
permission, tenant/branch authorization, writability and all import safety
controls. Reuse the existing import screens inside Basic's shell. This does not
give Basic attendance, analytics, AI, staff controls or WhatsApp.

## Alternatives and consequences

Using `selectedPostTrialPlan` would silently reinterpret historical preferences.
Changing card copy alone would keep the wrong access. A new entitlement bit is
unnecessary for a capability shared by every plan. The additive grant column
preserves the existing grant identity and owner uniqueness while making the
promise explicit. No prices, subscription lifecycle or provider APIs change.

## Rollout and recovery

Apply the migration first and deploy matching tier-aware readers/writers before
exposing new choices. Preserve historical dates and receipts. After non-Standard
grants exist, retain the tier-aware resolver during rollback; an older binary
would alter promised access. See the production runbook for the handoff and the
onboarding implementation record for local test evidence. Human ADR acceptance,
visual acceptance and production release are independent pending steps.
