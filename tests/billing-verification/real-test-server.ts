/** Read-only inspection of existing synthetic aggregate billing fixtures. */
import { readFileSync, writeFileSync } from "node:fs";
import { readVerifiedSyntheticFixtures, sanitizeStoredTestError, validateResumeProof } from "./real-test-resume-guard.mjs";

const database = process.env.BILLING_REAL_TEST_DATABASE;
const args = process.argv.slice(2);
const verifyCompleted = args[0] === "--verify-completed";
const inspectOnly = args[0] === "--inspect";
if (args.length !== 1 || !(verifyCompleted || inspectOnly) || process.env.BILLING_REAL_TEST_RESUME !== "1") {
    throw new Error("Use branch-preauthorization.ts for new branch Checkouts. This script only inspects historical Test fixtures.");
}
const target = new URL(process.env.DATABASE_URL ?? "http://invalid");

if (process.env.BILLING_REAL_TEST_HARNESS !== "1" || process.env.RAZORPAY_MODE !== "TEST"
    || !process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") || !process.env.RAZORPAY_KEY_SECRET
    || process.env.VERCEL_ENV !== "development" || process.env.RAZORPAY_BILLING_WRITES_ENABLED !== "false"
    || !database || !/^lab_lords_billing_real_[a-f0-9]{12}_browser_test$/.test(database)
    || target.protocol !== "postgresql:" || target.hostname !== "127.0.0.1" || target.pathname !== `/${database}`
    || process.env.ACCELERATE_URL || process.env.DIRECT_URL !== process.env.DATABASE_URL) {
    throw new Error("Refusing an unguarded or non-Test billing harness target.");
}


// Production service error logging may attach provider error objects. This

// harness deliberately retains only a constant diagnostic label on stderr.

const safeStderr = console.error.bind(console);

console.error = () => safeStderr("Test harness/service error; sensitive details suppressed.");

console.warn = () => safeStderr("Test harness/service warning; sensitive details suppressed.");

type Fixture = { scenario: string; ownerId: string; orgId: string };
const providerCalls = { reads: 0, creates: 0, updates: 0, scheduledUndos: 0, otherWrites: 0 };
const nativeFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== "https://api.razorpay.com" || !url.pathname.startsWith("/v1/")) {
        throw new Error("The real Test harness blocks unrelated external providers.");
    }
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method !== "GET") throw new Error("Historical inspection only allows provider reads.");
    providerCalls.reads += 1;
    return nativeFetch(input, init);
};

const { prisma } = await import("../../lib/prisma");

const { getRazorpayClient, RazorpayApiError } = await import("../../lib/razorpay");

const identity = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;

if (identity[0]?.name !== database) throw new Error("The guarded Test database identity changed.");

const proof = JSON.parse(readFileSync("test-results/billing-verification/three-plan-real-test-database-proof.json", "utf8"));
if (proof.catalogVersion !== 2 || validateResumeProof(proof, process.env.BILLING_REAL_TEST_CONTAINER_ID) !== database) {
    throw new Error("Historical proof does not match the process target.");
}
const fixtures = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return readVerifiedSyntheticFixtures(database, async (sql: string) => tx.$queryRawUnsafe(sql), 2);
}) as Record<string, Fixture>;

function safeProviderShape(value: unknown): unknown {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const allowed = ["id", "entity", "status", "amount", "amount_paid", "amount_due", "amount_refunded", "refund_status", "method", "currency", "captured", "subscription_id", "invoice_id", "payment_id", "plan_id", "quantity", "paid_count", "current_start", "current_end", "start_at", "charge_at", "expire_by", "billing_start", "billing_end", "type", "unit_amount", "unit_price", "price", "gross_amount", "net_amount", "tax_amount", "has_scheduled_changes", "change_scheduled_at"];
    const safe: Record<string, unknown> = { presentFields: allowed.filter(key => Object.hasOwn(record, key)) };
    for (const key of allowed) {
        const field = record[key];
        if (field === null || ["string", "number", "boolean"].includes(typeof field)) safe[key] = field;
    }
    if (Array.isArray(record.line_items)) safe.line_items = record.line_items.map(safeProviderShape);
    if (record.item && typeof record.item === "object") safe.item = safeProviderShape(record.item);
    return safe;
}


if (verifyCompleted) {
    // Prove the pre-network guard is active before invoking billing services.
    let guardProved = false;
    try { await globalThis.fetch("https://api.razorpay.com/v1/subscriptions", { method: "POST" }); }
    catch (error) { guardProved = error instanceof Error && error.message === "Historical inspection only allows provider reads."; }
    if (!guardProved) throw new Error("Provider-write guard was not proved.");
    const { verifyCompletedCheckouts } = await import("./verify-completed-checkouts");
    await verifyCompletedCheckouts(fixtures);
    if (providerCalls.creates + providerCalls.updates + providerCalls.scheduledUndos + providerCalls.otherWrites !== 0) throw new Error("Unexpected provider write.");
    console.log("Historical Test payment and replacement evidence verified.");
    await prisma.$disconnect();
    process.exit(0);
}
if (inspectOnly) {
    const client = getRazorpayClient();
    const inspections: unknown[] = [];
    async function inspectRead(operation: () => Promise<unknown>) {
        try { return { ok: true, value: safeProviderShape(await operation()) }; }
        catch (error) { return { ok: false, errorName: error instanceof RazorpayApiError ? "RazorpayApiError" : "Error",
            ...(error instanceof RazorpayApiError ? { kind: error.kind, status: error.status } : {}) }; }
    }
    for (const { scenario, orgId } of Object.values(fixtures)) {
        const [subscriptions, changes, invoices, actions] = await Promise.all([
            prisma.organizationSubscription.findMany({ where: { organizationId: orgId, providerMode: "TEST" }, select: { id: true, razorpaySubscriptionId: true } }),
            prisma.organizationBillingChange.findMany({ where: { organizationId: orgId }, select: { id: true, type: true, status: true, failureCategory: true, failureCode: true, lastError: true, providerPaymentId: true } }),
            prisma.organizationSubscriptionInvoice.findMany({ where: { organizationId: orgId }, select: { razorpayPaymentId: true } }),
            prisma.billingProviderAction.findMany({ where: { organizationId: orgId, providerMode: "TEST" }, select: { changeId: true, purpose: true, status: true, failureKind: true } }),
        ]);
        const paymentIds = new Set([...changes.map(change => change.providerPaymentId), ...invoices.map(invoice => invoice.razorpayPaymentId)].filter((id): id is string => Boolean(id)));
        const providerSubscriptions: unknown[] = [];
        for (const subscription of subscriptions) {
            const provider = await inspectRead(() => client.fetchSubscription(subscription.razorpaySubscriptionId));
            let providerInvoices: unknown;
            try {
                const collection = await client.fetchSubscriptionInvoices(subscription.razorpaySubscriptionId);
                providerInvoices = { ok: true, count: collection.count, items: collection.items.map(safeProviderShape) };
                for (const invoice of collection.items) {
                    if (invoice.subscription_id === subscription.razorpaySubscriptionId && invoice.payment_id) paymentIds.add(invoice.payment_id);
                }
            } catch (error) { providerInvoices = { ok: false, errorName: error instanceof RazorpayApiError ? "RazorpayApiError" : "Error",
                ...(error instanceof RazorpayApiError ? { kind: error.kind, status: error.status } : {}) }; }
            providerSubscriptions.push({ localSubscriptionId: subscription.id, provider, invoices: providerInvoices });
        }
        const payments = [];
        for (const paymentId of paymentIds) payments.push(await inspectRead(() => client.fetchPayment(paymentId)));
        const safeChanges = changes.map(({ lastError, ...change }) => ({ ...change,
            lastError: sanitizeStoredTestError(lastError, [process.env.RAZORPAY_KEY_ID, process.env.RAZORPAY_KEY_SECRET]),
        }));
        inspections.push({ scenario, changes: safeChanges, actions, subscriptions: providerSubscriptions, payments });
    }
    const evidence = { mode: "TEST", readOnly: true, observedAt: new Date().toISOString(), providerCalls, fixtures: inspections };
    writeFileSync("test-results/billing-verification/three-plan-real-test-provider-inspection.json", JSON.stringify(evidence, null, 2));
    console.log("Read-only Test inspection complete. Sanitized provider shapes saved to test-results/billing-verification/three-plan-real-test-provider-inspection.json.");
    await prisma.$disconnect();
    process.exit(0);
}
