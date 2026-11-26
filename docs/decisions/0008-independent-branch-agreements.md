# 0008 Independent branch agreements

- Status: Proposed
- Date: 2026-11-25
- Deciders: Pending

## Context

Owners need Basic, Standard and Pro in the same organization. The existing aggregate subscription has one price, quantity and renewal date. Applying an organization's highest tier to every branch would grant features across commercial agreements.

## Decision proposed

Keep the organization as the tenant and Account Billing as the owner's control surface. In BRANCH_V3, bind each quantity-one recurring subscription, commercial operation and evidence record to one branch agreement. Keep the owner trial at its original owner, tier and dates. Shared sender resources remain organization-owned. Branch policies and report inclusion use effective branch access. Preserve operational records as plans change.

Keep aggregate and branch agreements distinguishable throughout their lifetimes. Create branch agreements during onboarding and initialize retained branches structurally. Keep historical settlement on its original subscription. A recorded future preference cannot establish paid access. Handle outstanding historical mandates separately with their owner.

## Consequences

Owners can receive separate debits and invoices on different dates. Billing services need agreement-level replay protection and reconciliation. The final-billable-branch rule still coordinates branches under the organization lock. Historical invoices retain their original commercial owner.

Implementation, provider prerequisites and recovery steps are in the [rollout guide](../billing/independent-branch-rollout.md).
