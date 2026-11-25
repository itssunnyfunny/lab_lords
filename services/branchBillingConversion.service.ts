import { createHash } from "node:crypto";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getBillingPlan, isCheckoutBillingPlanId, type BillingPlanId } from "@/lib/billingPlans";
import { getRazorpayClient, resolveRazorpayMode, toRazorpaySubunits } from "@/lib/razorpay";
import { TERMINAL_STATUSES } from "@/lib/billingState";
import { BILLING_PAID_EVIDENCE_INCLUDE, resolveTrustedPaidThrough } from "./billingPaidEvidence.service";
import { getReplacementUndoCutoffAt, getSafeReplacementCycleBoundary, isSupportedRecurringPaymentMethod } from "./billingReplacementPolicy";

type Choices = Readonly<Record<string, BillingPlanId>>;
const mandateReview = "Reconcile all mandates and confirm recurring collection has ended";

function previewRenewingCohort(input: {
    source: { id: string; status: string; plan: string; period: string; interval: number; providerPaymentMethod: string;
        cancelAtCycleEnd: boolean; lastReconciledAt: Date | null; currentEnd: Date | null };
    branches: { id: string; billingStatus: string }[];
    choices: Choices;
    paidThrough: Date | null;
    trial: { plan: string; endsAt: Date } | null;
    hasSingleRenewingMandate: boolean;
    holds: string[];
    now: Date;
}) {
    const { source, branches, choices, paidThrough, trial, holds, now } = input;
    const successors = branches.map(branch => {
        const plan = isCheckoutBillingPlanId(choices[branch.id]) ? getBillingPlan(choices[branch.id]) : null;
        const quantity = branch.billingStatus === "ACTIVE" ? 1 : branch.billingStatus === "ARCHIVED" ? 0 : null;
        const unitAmount = plan?.amount == null ? null : toRazorpaySubunits(plan.amount, plan.currency);
        return {
            branchId: branch.id, branchStatus: branch.billingStatus, proposedPlan: plan?.id ?? null,
            proposedQuantity: quantity, catalogueUnitAmountSubunits: unitAmount,
            proposedMonthlyGrossSubunits: quantity === 0 ? 0 : quantity === 1 ? unitAmount : null,
            sourcePaidThrough: quantity === 1 ? paidThrough : null, ownerTrial: quantity === 1 ? trial : null,
        };
    });
    // These dates only describe the existing replacement policy's candidate.
    // They never authorize a charge or promise another paid source period.
    let candidateBoundary: Date | null = null;
    let timingReason: string;
    if (holds.some(reason => reason !== mandateReview) || !input.hasSingleRenewingMandate
        || source.status !== "ACTIVE" || !source.lastReconciledAt || source.cancelAtCycleEnd
        || !source.currentEnd || !paidThrough || source.currentEnd.getTime() !== paidThrough.getTime()
        || source.period !== "monthly" || !Number.isSafeInteger(source.interval) || source.interval < 1
        || !isSupportedRecurringPaymentMethod(source.providerPaymentMethod)) {
        timingReason = "No common date can be proposed until the source cadence, settlement, lifecycle, discounts and outstanding operations are reconciled.";
    } else {
        const boundary = getSafeReplacementCycleBoundary({ now, currentCycleEnd: source.currentEnd, intervalMonths: source.interval });
        if (trial && trial.endsAt > boundary) {
            timingReason = "The original owner trial extends past the candidate source boundary.";
        } else {
            candidateBoundary = boundary;
            timingReason = boundary > paidThrough
                ? "This candidate requires a later source renewal and its exact settlement."
                : "The candidate uses the currently settled source boundary.";
        }
    }
    return {
        sourceId: source.id, sourceStatus: source.status, sourcePlan: source.plan, sourcePaymentMethod: source.providerPaymentMethod,
        lastReconciledAt: source.lastReconciledAt, catalogueCurrency: "INR", successors,
        candidateCommonStartAt: candidateBoundary,
        candidateAuthorizeBy: candidateBoundary ? getReplacementUndoCutoffAt(candidateBoundary) : null,
        timingReason, authorizationState: "NOT_STAGED" as const,
        holdReason: "The entire cohort stays on its existing mandate until all successor authorizations and source nonrenewal can be coordinated before debit.",
    };
}

async function inventory(tx: Prisma.TransactionClient, organizationId: string, choices: Choices) {
    const org = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        include: {
            branches: { orderBy: { id: "asc" }, select: { id: true, billingStatus: true, billingAgreement: { select: { branchId: true } } } },
            ownerTrialGrant: true, subscription: { include: BILLING_PAID_EVIDENCE_INCLUDE },
            pendingSubscriptionReplacement: { select: { id: true } },
            subscriptions: { orderBy: { id: "asc" }, select: { id: true, status: true, razorpaySubscriptionId: true,
                providerMode: true, razorpayPlanId: true, quantity: true, currentStart: true, currentEnd: true,
                billingOfferId: true, lastReconciledAt: true } },
            subscriptionInvoices: { orderBy: { razorpayInvoiceId: "asc" }, select: {
                organizationSubscriptionId: true, agreementBranchId: true, razorpayInvoiceId: true, razorpayPaymentId: true,
                status: true, amountSubunits: true, amountPaidSubunits: true, amountDueSubunits: true, currency: true,
                periodStart: true, periodEnd: true, paidAt: true,
            } },
            billingChanges: { where: { OR: [{ status: { in: ["QUEUED", "PROCESSING", "SCHEDULED", "AWAITING_PAYMENT"] } },
                { status: "FAILED", resolvedAt: null }] }, orderBy: { id: "asc" }, select: { id: true } },
            providerActions: { where: { status: { notIn: ["CONFIRMED", "REJECTED"] } }, select: { id: true } },
            offerGrants: { where: { status: { in: ["ELIGIBLE", "RESERVED"] } }, select: { id: true } },
            _count: { select: { subscriptionHistory: true, subscriptionInvoices: true } },
        },
    });
    const now = new Date();
    const source = org.subscription;
    const paidThrough = resolveTrustedPaidThrough(source, now);
    const active = org.branches.filter(branch => branch.billingStatus === "ACTIVE");
    const holds: string[] = [];
    if (org.billingModelVersion !== "WORKSPACE_V2") holds.push("Review the existing billing model");
    if (org.branches.some(branch => branch.billingAgreement)) holds.push("Agreement records already exist");
    if (!active.length || org.branches.some(branch => !["ACTIVE", "ARCHIVED"].includes(branch.billingStatus))) holds.push("Resolve branch lifecycle changes");
    if (Object.keys(choices).length !== org.branches.length || org.branches.some(b => !Object.hasOwn(choices, b.id) || !isCheckoutBillingPlanId(choices[b.id]))) {
        holds.push("Review a catalogue plan for every branch including archived branches");
    }
    if (org.billingMutationLeaseToken || org.billingChanges.length || org.providerActions.length || org.pendingSubscriptionReplacement) holds.push("Resolve pending provider operations");
    if (org.offerGrants.length || source?.billingOfferId) holds.push("Preserve existing offer and discount commitments");
    if (org.subscriptions.some(sub => !TERMINAL_STATUSES.has(sub.status) || !sub.lastReconciledAt)) holds.push(mandateReview);
    if (source?.paidThrough && source.paidThrough > now && !paidThrough) holds.push("Resolve the source paid coverage evidence");
    if (org.subscriptions.some(sub => sub.providerMode !== resolveRazorpayMode())) holds.push("Reconcile provider mode");
    if (source && (source.quantity !== active.length || source.currentOrganizationId !== organizationId)) holds.push("Confirm the complete covered branch set");
    if (org.subscriptions.length && !source) holds.push("Identify the original aggregate agreement");
    if (org.subscriptionInvoices.some(invoice => !invoice.organizationSubscriptionId || invoice.agreementBranchId)) {
        holds.push("Resolve invoices with uncertain agreement ownership");
    }
    if (org.subscriptionInvoices.some(invoice => invoice.status === "paid" && invoice.periodEnd && invoice.periodEnd > now
        && (!paidThrough || invoice.organizationSubscriptionId !== source?.id
            || invoice.razorpayInvoiceId !== source?.lastConfirmedInvoiceId))) {
        holds.push("Resolve overlapping or unconfirmed aggregate paid periods");
    }
    const incompleteWebhooks = await tx.razorpayWebhookEvent.count({ where: { processedAt: null, OR: [
        { organizationId }, { razorpaySubscriptionId: { in: org.subscriptions.map(sub => sub.razorpaySubscriptionId) } },
        { organizationSubscriptionId: { in: org.subscriptions.map(sub => sub.id) } },
        { razorpayPaymentId: { in: org.subscriptionInvoices.flatMap(invoice => invoice.razorpayPaymentId ? [invoice.razorpayPaymentId] : []) } },
    ] } });
    if (incompleteWebhooks) holds.push("Resolve queued webhook receipts");
    const grant = org.ownerTrialGrant;
    const trial = grant?.status === "ACTIVE" && grant.trialEndsAt && grant.trialEndsAt > now
        && grant.ownerId === org.ownerId && grant.organizationId === org.id ? { plan: grant.trialPlan, endsAt: grant.trialEndsAt } : null;
    const renewingCohort = org.billingModelVersion === "WORKSPACE_V2" && source && !TERMINAL_STATUSES.has(source.status)
        ? previewRenewingCohort({
            source, branches: org.branches, choices, holds, trial, now,
            paidThrough: source.organizationId === org.id && source.currentOrganizationId === org.id && source.agreementBranchId == null
                && source.providerMode === resolveRazorpayMode() && source.quantity === active.length ? paidThrough : null,
            hasSingleRenewingMandate: org.subscriptions.filter(sub => !TERMINAL_STATUSES.has(sub.status)).length === 1
                && org.subscriptions.every(sub => sub.lastReconciledAt),
        }) : null;
    const snapshot = {
        organizationId, model: org.billingModelVersion, sequence: org.billingMutationSequence,
        branches: org.branches.map(b => ({ id: b.id, status: b.billingStatus, selectedPlan: choices[b.id] ?? null })),
        sourceId: source?.id ?? null, invoiceId: source?.lastConfirmedInvoiceId ?? null, paidThrough, renewingCohort,
        trials: org.ownerTrialGrant && { id: org.ownerTrialGrant.id, status: org.ownerTrialGrant.status, plan: org.ownerTrialGrant.trialPlan,
            start: org.ownerTrialGrant.trialStartedAt, end: org.ownerTrialGrant.trialEndsAt, consumed: org.ownerTrialGrant.consumedAt },
        mandates: org.subscriptions, invoices: org.subscriptionInvoices,
        historyRows: org._count.subscriptionHistory, invoiceRows: org._count.subscriptionInvoices,
        openChanges: org.billingChanges.map(row => row.id), openActions: org.providerActions.map(row => row.id), holds,
    };
    const digest = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    return { snapshot, digest };
}

type Inventory = Awaited<ReturnType<typeof inventory>>["snapshot"];

function sameProviderTime(value: number | null | undefined, stored: Date | null) {
    if (value === null) return stored === null;
    return value !== undefined && Number.isSafeInteger(value) && value > 0 && stored?.getTime() === value * 1000;
}

async function verifyTerminalMandate(mandate: Inventory["mandates"][number], inventory: Inventory) {
    const provider = getRazorpayClient();
    const [actual, collection] = await Promise.all([
        provider.fetchSubscription(mandate.razorpaySubscriptionId),
        provider.fetchSubscriptionInvoices(mandate.razorpaySubscriptionId),
    ]);
    const held = "Conversion held. Reconcile the provider mandate, invoices and payments and repeat preflight.";
    if (actual.entity !== "subscription" || actual.id !== mandate.razorpaySubscriptionId
        || actual.plan_id !== mandate.razorpayPlanId || actual.quantity !== mandate.quantity
        || actual.status.toUpperCase() !== mandate.status || actual.has_scheduled_changes !== false
        || !sameProviderTime(actual.current_start, mandate.currentStart) || !sameProviderTime(actual.current_end, mandate.currentEnd)) {
        throw new Error(held);
    }
    const invoices = new Map(inventory.invoices.filter(row => row.organizationSubscriptionId === mandate.id)
        .map(row => [row.razorpayInvoiceId, row]));
    if (collection.entity !== "collection" || !Array.isArray(collection.items) || collection.count !== collection.items.length
        || collection.count !== invoices.size || actual.paid_count !== collection.items.filter(invoice => invoice.status === "paid").length) {
        throw new Error(held);
    }
    for (const invoice of collection.items) {
        const row = invoices.get(invoice.id);
        if (!row || invoice.entity !== "invoice" || invoice.subscription_id !== actual.id || invoice.status !== row.status
            || !["paid", "cancelled", "expired"].includes(invoice.status)
            || (invoice.payment_id ?? null) !== row.razorpayPaymentId || invoice.currency !== row.currency
            || invoice.amount !== row.amountSubunits || invoice.amount_paid !== row.amountPaidSubunits || invoice.amount_due !== row.amountDueSubunits
            || !sameProviderTime(invoice.billing_start ?? null, row.periodStart) || !sameProviderTime(invoice.billing_end ?? null, row.periodEnd)
            || !sameProviderTime(invoice.paid_at ?? null, row.paidAt)) throw new Error(held);
        invoices.delete(invoice.id);
        if (invoice.status !== "paid") {
            if (invoice.amount_paid !== 0 || invoice.payment_id) throw new Error(held);
            continue;
        }
        if (!invoice.payment_id || !invoice.billing_start || !invoice.billing_end || invoice.billing_end <= invoice.billing_start
            || !invoice.paid_at || invoice.amount <= 0 || invoice.amount_paid !== invoice.amount || invoice.amount_due !== 0) throw new Error(held);
        if (mandate.id === inventory.sourceId && invoice.id === inventory.invoiceId && inventory.paidThrough) {
            const payment = await provider.fetchPayment(invoice.payment_id);
            if (payment.entity !== "payment" || payment.id !== invoice.payment_id || payment.status !== "captured" || payment.captured !== true
                || payment.amount !== invoice.amount || payment.currency !== invoice.currency || payment.amount_refunded !== 0
                || payment.refund_status != null || (payment.invoice_id != null && payment.invoice_id !== invoice.id)
                || (payment.subscription_id != null && payment.subscription_id !== actual.id)) throw new Error(held);
        }
    }
}

export class BranchBillingConversion {
    static preflight(organizationId: string, choices: Choices) {
        return prisma.$transaction(async tx => {
            await tx.$executeRaw`SET TRANSACTION READ ONLY`;
            return inventory(tx, organizationId, choices);
        }, { isolationLevel: "RepeatableRead" });
    }

    /** Operator-only. A stale preview or an unresolved provider obligation admits zero rows. */
    static async apply(organizationId: string, choices: Choices, reviewedDigest: string) {
        const preview = await this.preflight(organizationId, choices);
        if (preview.snapshot.holds.length || preview.digest !== reviewedDigest) throw new Error("Conversion held. Review the current inventory.");
        for (const sub of preview.snapshot.mandates) {
            await verifyTerminalMandate(sub, preview.snapshot);
        }
        return prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId} FOR UPDATE`;
            const current = await inventory(tx, organizationId, choices);
            if (current.snapshot.holds.length || current.digest !== reviewedDigest) throw new Error("Conversion inventory changed before admission.");
            const { branches, sourceId, paidThrough, historyRows, invoiceRows } = current.snapshot;
            for (const branch of branches) {
                const carriesCoverage = branch.status === "ACTIVE" && paidThrough != null;
                await tx.branchBillingAgreement.create({ data: {
                    organizationId, branchId: branch.id, selectedPlan: choices[branch.id], billingMutationSequence: 1,
                    legacyCoverageSubscriptionId: carriesCoverage ? sourceId : null,
                    legacyCoverageEndsAt: carriesCoverage ? paidThrough : null,
                } });
                const now = new Date();
                await tx.organizationBillingChange.create({ data: { organizationId, branchId: branch.id, agreementBranchId: branch.id,
                    sequence: 1, type: "LEGACY_TRANSITION", idempotencyKey: `branch-conversion:${reviewedDigest}:${branch.id}`,
                    toPlan: choices[branch.id], status: "APPLIED", operationStatus: "APPLIED", appliedAt: now, resolvedAt: now } });
            }
            if (sourceId) await tx.organizationSubscription.update({
                where: { id: sourceId, organizationId, currentOrganizationId: organizationId, agreementBranchId: null },
                data: { currentOrganizationId: null },
            });
            await tx.organization.update({ where: { id: organizationId, billingModelVersion: "WORKSPACE_V2" }, data: { billingModelVersion: "BRANCH_V3" } });
            return { organizationId, reviewedDigest, agreementsCreated: branches.length, historyRows, invoiceRows, providerWrites: 0 };
        }, { isolationLevel: "Serializable" });
    }
}
