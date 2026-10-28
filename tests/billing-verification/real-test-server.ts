/** Test-only loopback harness. Never imported by an application route. */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { randomBytes, timingSafeEqual } from "node:crypto";

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { basicRetestIdentity, readVerifiedSyntheticFixtures, sanitizeStoredTestError, validateResumeProof } from "./real-test-resume-guard.mjs";



const origin = "http://127.0.0.1:4191";

const database = process.env.BILLING_REAL_TEST_DATABASE;

const resume = process.env.BILLING_REAL_TEST_RESUME === "1";

const verifyCompleted = process.argv.includes("--verify-completed");
const inspectOnly = process.argv.includes("--inspect");

const addBasicRetest = process.argv.includes("--add-basic-retest");

if ((inspectOnly || addBasicRetest || verifyCompleted) && !resume) throw new Error("Inspection or fixture extension requires guarded resume.");

if (inspectOnly && addBasicRetest) throw new Error("Read-only inspection cannot add fixtures.");

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");

if (process.env.BILLING_REAL_TEST_HARNESS !== "1" || process.env.RAZORPAY_MODE !== "TEST"

    || !process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") || !process.env.RAZORPAY_KEY_SECRET

    || process.env.VERCEL_ENV !== "development" || process.env.RAZORPAY_BILLING_WRITES_ENABLED !== "true"

    || !database || !/^lab_lords_billing_real_[a-f0-9]{12}_browser_test$/.test(database)

    || target.protocol !== "postgresql:" || target.hostname !== "127.0.0.1" || target.pathname !== `/${database}`

    || process.env.ACCELERATE_URL || process.env.DIRECT_URL !== process.env.DATABASE_URL) {

    throw new Error("Refusing an unguarded or non-Test billing harness target.");

}



const token = randomBytes(32).toString("hex");

// Production service error logging may attach provider error objects. This

// harness deliberately retains only a constant diagnostic label on stderr.

const safeStderr = console.error.bind(console);

console.error = () => safeStderr("Test harness/service error; sensitive details suppressed.");

console.warn = () => safeStderr("Test harness/service warning; sensitive details suppressed.");

const fixtureSuffix = randomBytes(6).toString("hex");

type Fixture = { scenario: string; ownerId: string; orgId: string };

let fixtures: Record<string, Fixture> = {

    standard: { scenario: "standard", ownerId: `billing_real_owner_standard_${fixtureSuffix}`, orgId: `billing_real_org_standard_${fixtureSuffix}` },

    pro: { scenario: "pro", ownerId: `billing_real_owner_pro_${fixtureSuffix}`, orgId: `billing_real_org_pro_${fixtureSuffix}` },
    basic: { scenario: "basic", ownerId: `billing_real_owner_basic_${fixtureSuffix}`, orgId: `billing_real_org_basic_${fixtureSuffix}` },

};

type FaultKind = "MUTATE" | "UNDO_SCHEDULE";

let armedFault: { kind: FaultKind; subscriptionId: string } | null = null;

const droppedResponses: Array<{ kind: FaultKind; successfulResponseLost: true }> = [];

const providerCalls = { reads: 0, creates: 0, updates: 0, scheduledUndos: 0, otherWrites: 0 };

const nativeFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = async (input, init) => {

    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

    if (url.origin !== "https://api.razorpay.com" || !url.pathname.startsWith("/v1/")) {

        throw new Error("The real Test harness blocks unrelated external providers.");

    }

    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (addBasicRetest || ((inspectOnly || verifyCompleted) && method !== "GET")) throw new Error("Fixture extension and read-only inspection refuse provider mutations.");

    if (method === "GET") providerCalls.reads += 1;

    else if (method === "PATCH" && /^\/v1\/subscriptions\/[^/]+$/.test(url.pathname)) providerCalls.updates += 1;

    else if (method === "POST" && url.pathname.endsWith("/cancel_scheduled_changes")) providerCalls.scheduledUndos += 1;

    else if (method === "POST" && ["/v1/plans", "/v1/subscriptions"].includes(url.pathname)) providerCalls.creates += 1;

    else providerCalls.otherWrites += 1;

    const selectedFault = armedFault;

    const faultMatches = selectedFault && (selectedFault.kind === "MUTATE"

        ? method === "PATCH" && url.pathname === `/v1/subscriptions/${selectedFault.subscriptionId}`

        : method === "POST" && url.pathname === `/v1/subscriptions/${selectedFault.subscriptionId}/cancel_scheduled_changes`);

    const response = await nativeFetch(input, init);

    if (faultMatches && response.ok && armedFault === selectedFault) {

        // The real Test provider completed its mutation. Discard the transport

        // response only, preserving provider state and exercising UNKNOWN recovery.

        await response.arrayBuffer();

        armedFault = null;

        droppedResponses.push({ kind: selectedFault.kind, successfulResponseLost: true });

        throw new TypeError("Controlled Test provider response loss");

    }

    return response;

};



const { prisma } = await import("../../lib/prisma");

const { BillingService } = await import("../../services/billing.service");

const { EntitlementService, SubscriptionEntitlementError } = await import("../../services/entitlement.service");

const { getRazorpayClient, RazorpayApiError } = await import("../../lib/razorpay");

const { hasFeatureEntitlement } = await import("../../lib/billingPolicy");

const identity = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;

if (identity[0]?.name !== database) throw new Error("The guarded Test database identity changed.");

if (resume) {

    const proof = JSON.parse(readFileSync("test-results/billing-verification/three-plan-real-test-database-proof.json", "utf8"));

    if (proof.catalogVersion !== 2) throw new Error("Catalogue v2 proof required.");
    if (validateResumeProof(proof, process.env.BILLING_REAL_TEST_CONTAINER_ID) !== database) throw new Error("Resume proof does not match the process target.");

    fixtures = await prisma.$transaction(async tx => {

        await tx.$executeRaw`SET TRANSACTION READ ONLY`;

        return readVerifiedSyntheticFixtures(database, async (sql: string) => tx.$queryRawUnsafe(sql), 2);

    }) as Record<string, Fixture>;

} else {

    if (await prisma.user.count() !== 0 || await prisma.organization.count() !== 0) throw new Error("Fresh mode requires an empty disposable database.");

    for (const { ownerId, orgId, scenario } of Object.values(fixtures)) {

        await prisma.user.create({ data: { id: ownerId, email: `billing-test-${scenario}-${fixtureSuffix}@example.com`, name: "Synthetic Billing Owner" } });

        await prisma.organization.create({ data: { id: orgId, ownerId, name: "Synthetic Razorpay Test Workspace", billingModelVersion: "WORKSPACE_V2", selectedPostTrialPlan: scenario === "basic" ? "BASIC" : scenario === "standard" ? "STANDARD" : "PRO" } });

        await prisma.branch.create({ data: { organizationId: orgId, name: "Synthetic Test Branch", billingStatus: "ACTIVE" } });

    }

}



if (addBasicRetest) {

    // Explicit test-fixture extension only. Original rows, provider state and

    // the original isolation proof are never modified by this mode.

    const addition = basicRetestIdentity(fixtures);

    const additionPath = "test-results/billing-verification/real-test-basic-retest-proof.json";

    if (existsSync(additionPath)) {

        const prior = JSON.parse(readFileSync(additionPath, "utf8"));

        if (prior.database !== database || prior.containerId !== process.env.BILLING_REAL_TEST_CONTAINER_ID

            || prior.orgId !== addition.orgId || prior.ownerId !== addition.ownerId || prior.branchId !== addition.branchId

            || prior.mode !== "TEST" || prior.providerMutations !== 0) throw new Error("Retest addition evidence does not match this exact fixture.");

    }

    const created = await prisma.$transaction(async tx => {

        // Serialize explicit additions and hold the verified identity tables

        // until all three new rows and their postcondition have committed.

        await tx.$executeRawUnsafe('LOCK TABLE "User", "Organization", "Branch" IN SHARE ROW EXCLUSIVE MODE');

        const existing = await readVerifiedSyntheticFixtures(database, async (sql: string) => tx.$queryRawUnsafe(sql)) as Record<string, Fixture>;

        if (existing["basic-retest"]) return false;

        const expected = basicRetestIdentity(existing);

        if (expected.orgId !== addition.orgId) throw new Error("Retest identity changed before insertion.");

        await tx.user.create({ data: { id: addition.ownerId, email: addition.email, name: "Synthetic Billing Owner" } });

        await tx.organization.create({ data: { id: addition.orgId, ownerId: addition.ownerId,

            name: "Synthetic Razorpay Test Workspace", billingModelVersion: "WORKSPACE_V2", selectedPostTrialPlan: "BASIC" } });

        await tx.branch.create({ data: { id: addition.branchId, organizationId: addition.orgId, name: "Synthetic Test Branch", billingStatus: "ACTIVE" } });

        const checked = await readVerifiedSyntheticFixtures(database, async (sql: string) => tx.$queryRawUnsafe(sql)) as Record<string, Fixture>;

        if (checked["basic-retest"]?.orgId !== addition.orgId) throw new Error("Retest fixture postcondition failed.");

        return true;

    });

    if (Object.values(providerCalls).some(count => count !== 0)) throw new Error("Fixture extension unexpectedly contacted a provider.");

    if (!existsSync(additionPath)) writeFileSync(additionPath, JSON.stringify({ database,

        containerId: process.env.BILLING_REAL_TEST_CONTAINER_ID, mode: "TEST", originalProofPreserved: true,

        originalFixturesPreserved: true, providerMutations: 0, providerReads: 0,

        createdThisRun: created, observedAt: new Date().toISOString(), ...addition }, null, 2), { flag: "wx" });

    console.log(created ? "Added the exact synthetic basic-retest owner/workspace/branch. Original fixtures preserved; zero provider calls. Resume the harness to use it."

        : "The exact synthetic basic-retest fixture already exists. No rows changed and zero provider calls.");

    await prisma.$disconnect();

    process.exit(0);

}



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
    catch (error) { guardProved = error instanceof Error && error.message === "Fixture extension and read-only inspection refuse provider mutations."; }
    if (!guardProved) throw new Error("Provider-write guard was not proved.");
    const { verifyCompletedCheckouts } = await import("./verify-completed-checkouts");
    await verifyCompletedCheckouts(fixtures);
    if (providerCalls.creates + providerCalls.updates + providerCalls.scheduledUndos + providerCalls.otherWrites !== 0) throw new Error("Unexpected provider write.");
    console.log("Three completed Test payments, feature gates, recovery re-entry and same-key plan-change replay verified; zero provider writes.");
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



let operationBusy = false;

let lastOutcome: { scenario: string; action: string; ok: boolean; code?: string; errorName?: string; providerKind?: string; providerStatus?: number | null } | null = null;

const phaseEvidence: Record<string, unknown[]> = Object.fromEntries(Object.keys(fixtures).map(scenario => [scenario, []]));

async function summary({ ownerId, orgId, scenario }: Fixture) {

    const [overview, entitlements, actions, changes] = await Promise.all([

        BillingService.listPlansForOrganization(ownerId, orgId),

        EntitlementService.getOrganizationProfile(orgId),

        prisma.billingProviderAction.findMany({ where: { organizationId: orgId }, orderBy: { admittedAt: "asc" },

            select: { changeId: true, purpose: true, status: true, providerMode: true, failureKind: true } }),

        prisma.organizationBillingChange.findMany({ where: { organizationId: orgId }, orderBy: { sequence: "asc" },

            select: { id: true, type: true, status: true, operationStatus: true, failureCategory: true, failureCode: true, fromPlan: true, toPlan: true,

                effectiveAt: true, undoCutoffAt: true, providerConfirmedAt: true, accessGrantedAt: true,

                replacementSubscription: { select: { razorpaySubscriptionId: true, plan: true, status: true,

                    providerPaymentMethod: true, providerStartAt: true, paidThrough: true, quantity: true } } } }),

    ]);

    const featureAssertions = await Promise.all((["STAFF_MANAGEMENT", "ADVANCED_ANALYTICS", "AI_ACCESS", "WHATSAPP_AUTOMATION"] as const).map(async entitlement => {

        try {

            await EntitlementService.assertOrganizationEntitlement(orgId, entitlement);

            return { entitlement, allowed: true };

        } catch (error) {

            if (error instanceof SubscriptionEntitlementError) return { entitlement, allowed: false };

            throw error;

        }

    }));

    const result = {

        mode: "TEST", scenario, processSession: fixtureSuffix, resumed: resume, observedAt: new Date().toISOString(), syntheticFixture: true, noTrial: true,

        current: overview.current ? { id: overview.current.id, providerSubscriptionId: overview.current.razorpaySubscriptionId,

            plan: overview.current.plan, status: overview.current.status, paymentMethod: overview.current.providerPaymentMethod,

            paidThrough: overview.current.paidThrough, quantity: overview.current.quantity } : null,

        access: { mode: entitlements.accessMode, canWrite: entitlements.canWrite, effectivePlan: entitlements.effectivePlan, entitlements: entitlements.entitlements },

        featureAssertions,

        clientFeatureGates: Object.fromEntries((["STAFF_CONTROLS", "ORG_ANALYTICS", "AI_REPORTS"] as const).map(feature => [feature, hasFeatureEntitlement(entitlements.entitlements, feature)])),

        invoices: overview.invoices.map(invoice => ({ status: invoice.status, amountSubunits: invoice.amountSubunits, currency: invoice.currency, paidAt: invoice.paidAt })),

        actions, changes, providerCallCountScope: "all fixtures in this harness process", providerCalls: { ...providerCalls }, armedFault: armedFault?.kind ?? null,

        droppedResponses: [...droppedResponses], lastOutcome,

    };

    // Evidence contains only synthetic IDs, service states and call counts.

    writeFileSync(`test-results/billing-verification/three-plan-real-test-summary-${scenario}.json`, JSON.stringify(result, null, 2));

    phaseEvidence[scenario].push(result);

    writeFileSync(`test-results/billing-verification/three-plan-real-test-phases-${scenario}${resume ? `-resumed-${fixtureSuffix}` : ""}.json`, JSON.stringify(phaseEvidence[scenario], null, 2));

    return result;

}



function send(response: ServerResponse, status: number, value: unknown) {

    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });

    response.end(JSON.stringify(value));

}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {

    if (!request.headers["content-type"]?.startsWith("application/json")) throw new Error("JSON_REQUIRED");

    const chunks: Buffer[] = [];

    let size = 0;

    for await (const chunk of request) {

        size += chunk.length;

        if (size > 16_384) throw new Error("BODY_LIMIT");

        chunks.push(Buffer.from(chunk));

    }

    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");

    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_REQUEST");

    return value as Record<string, unknown>;

}

function hasToken(value: string | string[] | undefined) {

    return typeof value === "string" && value.length === token.length && timingSafeEqual(Buffer.from(value), Buffer.from(token));

}

async function ownedChange(value: unknown, orgId: string) {

    if (typeof value !== "string") throw new Error("CHANGE_REQUIRED");

    const change = await prisma.organizationBillingChange.findFirst({ where: { id: value, organizationId: orgId }, select: { id: true } });

    if (!change) throw new Error("CHANGE_NOT_FOUND");

    return change.id;

}

function plan(value: unknown) {

    if (value !== "BASIC" && value !== "STANDARD" && value !== "PRO") throw new Error("PLAN_REQUIRED");

    return value;

}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lab Lords real Razorpay Test verification</title><style>body{font:16px system-ui;margin:0;background:#f5f6f5;color:#172b23}main{max-width:1000px;margin:auto;padding:28px}h1{font-size:24px}button{padding:12px;margin:4px;border:1px solid #668375;border-radius:6px;background:white;color:#163a28}button:disabled{opacity:.5}fieldset{margin:16px 0;border:1px solid #b2c5b7}pre{background:white;padding:16px;white-space:pre-wrap;overflow-wrap:anywhere}#notice{padding:12px;background:#fff0c1}</style></head><body><main><h1>Real Razorpay Test verification</h1><p>Isolated synthetic workspace. No trial. This harness uses production billing services and real Test provider responses. It cannot use Live credentials.</p><p id="notice" role="status">Loading isolated service state…</p><fieldset><legend>Initial checkout (fresh workspace only)</legend><button id="start-standard">Start Standard Test checkout — ₹299</button><button id="start-basic">Start Basic Test checkout — ₹99</button><button id="start-pro">Start Pro Test checkout — ₹499</button></fieldset><fieldset><legend>Changes and recovery</legend><button id="basic">Change to Basic</button><button id="standard">Change to Standard</button><button id="pro">Change to Pro</button><button id="arm">Drop the next successful undo response</button><button id="undo">Undo selected billing change</button><button id="retry">Recover selected billing change</button><button id="reopen-checkout">Reopen selected Test authorization</button><button id="reconcile">Reconcile selected billing change</button><button id="close-checkout">Close selected unfinished checkout (local only)</button><button id="provider">Read Test provider state</button><button id="refresh">Refresh service evidence</button></fieldset><p>Plan changes open a replacement Razorpay Test mandate for your review. Current paid access remains until the server confirms the applicable replacement state. The native update-and-undo scenario is unavailable for these card fixtures; the historical undo controls apply only to an existing provider-scheduled change.</p><p><label for="operation-select">Billing operation to inspect, reconcile, recover or undo</label><br><select id="operation-select" aria-label="Billing operation"></select></p><p>Use a Razorpay Test card in Checkout. Do not simulate later recurring charges before the update checks. Initial activation requires confirmed payment. A replacement upgrade may receive bounded complimentary access only when production service evidence grants it; paid cutover still requires payment.</p><pre id="evidence" aria-live="polite"></pre><pre id="provider-state"></pre></main><script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>

const token=${JSON.stringify(token)};const requestedFixture=new URLSearchParams(location.search).get('fixture');const scenario=['basic','pro'].includes(requestedFixture)?requestedFixture:'standard';document.querySelector('h1').textContent+=' — '+scenario+' fixture';let evidence=null;let busy=false;const notice=document.getElementById('notice');

async function api(path,data){const r=await fetch('/api/'+path+(path.includes('?')?'&':'?')+'fixture='+scenario,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Billing-Test-Token':token},body:data===undefined?undefined:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw new Error(result.code||'TEST_REQUEST_FAILED');return result;}

async function refresh(){const picker=document.getElementById('operation-select');const selected=picker.value;evidence=await api('summary');picker.replaceChildren();for(const change of evidence.changes){const option=document.createElement('option');option.value=change.id;option.textContent=change.type+' · '+change.status+' · '+change.id;picker.appendChild(option);}picker.value=evidence.changes.some(change=>change.id===selected)?selected:(evidence.changes.at(-1)?.id||'');document.getElementById('evidence').textContent=JSON.stringify(evidence,null,2);document.getElementById('start-basic').disabled=busy||Boolean(evidence.current&&!(evidence.current.status==='CREATED'&&evidence.current.plan==='BASIC'));document.getElementById('start-standard').disabled=busy||Boolean(evidence.current&&!(evidence.current.status==='CREATED'&&evidence.current.plan==='STANDARD'));document.getElementById('start-pro').disabled=busy||Boolean(evidence.current&&!(evidence.current.status==='CREATED'&&evidence.current.plan==='PRO'));return evidence;}

function latest(){const selected=document.getElementById('operation-select').value;if(!evidence||!evidence.changes.some(change=>change.id===selected))throw new Error('NO_OPERATION');return selected;}

async function run(action){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{const outcome=await action();notice.textContent=typeof outcome==='string'?outcome:'Completed. Inspect the authoritative service evidence below.';}catch(e){notice.textContent='Result: '+e.message+'. Refresh/reconcile before another change.';}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);await refresh();}}

function checkoutPayload(payload){if(!window.Razorpay)throw new Error('CHECKOUT_SCRIPT_UNAVAILABLE');const checkout=new Razorpay({key:payload.keyId,subscription_id:payload.subscriptionId,name:payload.name,description:payload.description,config:payload.config,prefill:payload.prefill,notes:payload.notes,remember_customer:false,handler:async response=>{await run(async()=>{await api('verify',{changeId:payload.changeId,razorpay_subscription_id:response.razorpay_subscription_id,razorpay_payment_id:response.razorpay_payment_id,razorpay_signature:response.razorpay_signature});});},modal:{ondismiss:()=>{void refresh();}}});checkout.on('payment.failed',()=>{notice.textContent='Test Checkout reported a payment failure. No access has been granted by this event.';});checkout.open();}

function requireEvidence(value,code){if(!value)throw new Error(code);}

function actionReceipt(state,changeId,purpose,status){return state.actions.some(action=>action.changeId===changeId&&action.purpose===purpose&&action.status===status);}

async function checkout(selectedPlan){checkoutPayload(await api('start',{plan:selectedPlan}));}

function hasCheckout(payload){return payload&&typeof payload.keyId==='string'&&typeof payload.subscriptionId==='string'&&typeof payload.changeId==='string'&&typeof payload.processingUrl==='string';}

function readCheckout(payload){return hasCheckout(payload)?payload:hasCheckout(payload?.checkout)?payload.checkout:null;}

async function changePlan(plan){const payload=await api('change-plan',{plan,idempotencyKey:crypto.randomUUID()});const checkout=readCheckout(payload);if(checkout)checkoutPayload(checkout);}

async function recoverSelected(){

 const before=await refresh();const changeId=latest();

 const uncertainUndo=actionReceipt(before,changeId,'UNDO_SCHEDULE','UNKNOWN');

 const payload=await api('retry',{changeId});

 const after=await refresh();

 if(uncertainUndo){requireEvidence(after.changes.find(change=>change.id===changeId)?.status==='UNDONE'&&actionReceipt(after,changeId,'UNDO_SCHEDULE','CONFIRMED')&&['creates','updates','scheduledUndos','otherWrites'].every(kind=>after.providerCalls[kind]===before.providerCalls[kind]),'READ_ONLY_RECOVERY_NOT_CONFIRMED');return 'Historical scheduled undo recovered with zero provider writes.';}

 const checkout=readCheckout(payload);if(checkout)checkoutPayload(checkout);

}

document.getElementById('reopen-checkout').onclick=()=>run(async()=>{const checkout=readCheckout(await api('operation?changeId='+encodeURIComponent(latest())));if(!checkout)throw new Error('SELECTED_OPERATION_HAS_NO_REUSABLE_CHECKOUT');checkoutPayload(checkout);});

document.getElementById('close-checkout').onclick=()=>run(()=>api('close-checkout',{changeId:latest()}));

document.getElementById('start-standard').onclick=()=>run(()=>checkout('STANDARD'));document.getElementById('start-pro').onclick=()=>run(()=>checkout('PRO'));document.getElementById('start-basic').onclick=()=>run(()=>checkout('BASIC'));

document.getElementById('basic').onclick=()=>run(()=>changePlan('BASIC'));document.getElementById('standard').onclick=()=>run(()=>changePlan('STANDARD'));document.getElementById('pro').onclick=()=>run(()=>changePlan('PRO'));

document.getElementById('arm').onclick=()=>run(()=>api('arm-loss',{kind:'UNDO_SCHEDULE'}));document.getElementById('undo').onclick=()=>run(()=>api('undo',{changeId:latest()}));document.getElementById('retry').onclick=()=>run(recoverSelected);document.getElementById('reconcile').onclick=()=>run(()=>api('reconcile',{changeId:latest()}));document.getElementById('provider').onclick=()=>run(async()=>{document.getElementById('provider-state').textContent=JSON.stringify(await api('provider'),null,2);});document.getElementById('refresh').onclick=()=>run(refresh);refresh().then(()=>notice.textContent='Ready. No provider mutation has been performed at startup.').catch(()=>notice.textContent='Unable to read the isolated Test state.');

</script></body></html>`;



const server = createServer(async (request, response) => {

    const url = new URL(request.url ?? "/", origin);

    if (request.headers.host !== "127.0.0.1:4191") return send(response, 403, { code: "LOOPBACK_HOST_REQUIRED" });

    if (request.method === "GET" && url.pathname === "/") {

        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" });

        response.end(html); return;

    }

    if (!hasToken(request.headers["x-billing-test-token"]) || (request.headers.origin && request.headers.origin !== origin)) return send(response, 403, { code: "TEST_SESSION_REQUIRED" });

    const scenarioKey = url.searchParams.get("fixture") ?? "standard";

    const fixture = Object.hasOwn(fixtures, scenarioKey) ? fixtures[scenarioKey] : undefined;

    if (!fixture) return send(response, 400, { code: "UNKNOWN_TEST_FIXTURE" });

    const { ownerId, orgId } = fixture;

    const action = url.pathname.replace("/api/", "");

    let ownsOperation = false;

    try {

        if (request.method === "GET" && action === "summary") return send(response, 200, await summary(fixture));

        if (request.method === "GET" && action === "operation") {

            const changeId = await ownedChange(url.searchParams.get("changeId"), orgId);

            return send(response, 200, await BillingService.getBillingOperation(ownerId, orgId, changeId));

        }

        if (request.method === "GET" && action === "provider") {

            const current = await prisma.organizationSubscription.findUnique({ where: { currentOrganizationId: orgId } });

            if (!current || current.providerMode !== "TEST") throw new Error("TEST_SUBSCRIPTION_REQUIRED");

            const value = await getRazorpayClient().fetchSubscription(current.razorpaySubscriptionId);

            return send(response, 200, { status: value.status, planId: value.plan_id, quantity: value.quantity, paidCount: value.paid_count, hasScheduledChanges: value.has_scheduled_changes, currentStart: value.current_start, currentEnd: value.current_end });

        }

        if (request.method !== "POST") return send(response, 405, { code: "METHOD_NOT_ALLOWED" });

        if (operationBusy) return send(response, 409, { code: "TEST_OPERATION_IN_PROGRESS" });

        operationBusy = true;

        ownsOperation = true;

        const input = await body(request);

        let result: unknown;

        if (action === "start") {

            const selectedPlan = plan(input.plan);

            const current = await prisma.organizationSubscription.findFirst({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" } });

            if (current && !(current.status === "CREATED" && current.plan === selectedPlan && current.currentOrganizationId === orgId)) throw new Error("CHECKOUT_ALREADY_CREATED");

            result = await BillingService.createSubscriptionCheckout(ownerId, orgId, { plan: selectedPlan, returnPath: `/org/${orgId}/billing` });

        } else if (action === "verify") {

            const changeId = await ownedChange(input.changeId, orgId);

            const verified = await BillingService.verifySubscriptionSuccess(ownerId, orgId, { changeId, razorpay_subscription_id: input.razorpay_subscription_id, razorpay_payment_id: input.razorpay_payment_id, razorpay_signature: input.razorpay_signature });

            result = { verified: verified.verified, pending: "pending" in verified ? verified.pending : false };

        } else if (action === "change-plan") {

            if (typeof input.idempotencyKey !== "string" || !/^[a-f0-9-]{36}$/i.test(input.idempotencyKey)) throw new Error("IDEMPOTENCY_REQUIRED");

            result = await BillingService.changeWorkspacePlan(ownerId, orgId, plan(input.plan), input.idempotencyKey, `/org/${orgId}/billing`);

        } else if (action === "undo") {

            await BillingService.undoWorkspaceChange(ownerId, orgId, await ownedChange(input.changeId, orgId));

        } else if (action === "retry") {

            result = await BillingService.retryBillingOperation(ownerId, orgId, await ownedChange(input.changeId, orgId));

        } else if (action === "reconcile") {

            await BillingService.reconcileMutation(ownerId, orgId, await ownedChange(input.changeId, orgId));

        } else if (action === "close-checkout") {

            const changeId = await ownedChange(input.changeId, orgId);

            const change = await prisma.organizationBillingChange.findFirst({ where: { id: changeId, organizationId: orgId },

                select: { type: true, status: true, operationStatus: true, replacementSubscriptionId: true, providerPaymentId: true } });

            if (!change || change.type !== "SUBSCRIPTION_AUTHORIZATION" || change.replacementSubscriptionId

                || change.status !== "AWAITING_PAYMENT" || change.operationStatus !== "CHECKOUT_OPEN" || change.providerPaymentId) {

                throw new Error("UNFINISHED_INITIAL_CHECKOUT_REQUIRED");

            }

            await BillingService.recordCheckoutEvent(ownerId, orgId, changeId, { event: "ABANDONED" });

        } else if (action === "arm-loss") {

            if (input.kind !== "MUTATE" && input.kind !== "UNDO_SCHEDULE") throw new Error("INVALID_FAULT");

            const current = await prisma.organizationSubscription.findUnique({ where: { currentOrganizationId: orgId } });

            if (!current || current.providerMode !== "TEST" || armedFault) throw new Error("FAULT_NOT_READY");

            armedFault = { kind: input.kind, subscriptionId: current.razorpaySubscriptionId };

        } else throw new Error("UNKNOWN_TEST_ACTION");

        lastOutcome = { scenario: fixture.scenario, action, ok: true };

        await summary(fixture);

        return send(response, 200, result ?? { ok: true });

    } catch (error) {

        // Deliberately omit provider descriptions, request bodies and signatures.

        const rawCode = error && typeof error === "object" && "code" in error ? String(error.code) : error instanceof Error ? error.message : "TEST_ACTION_FAILED";

        const code = /^[A-Z][A-Z_]{2,80}$/.test(rawCode) ? rawCode : "TEST_ACTION_FAILED";

        const errorName = error instanceof Error && ["Error", "TypeError", "RazorpayApiError", "RazorpayConfigurationError", "BillingValidationError", "BillingManualReviewRequiredError", "BillingChangeInProgressError", "BillingResourceNotFoundError", "PrismaClientKnownRequestError"].includes(error.name) ? error.name : "Error";

        const providerDetails = error instanceof RazorpayApiError ? { providerKind: error.kind, providerStatus: error.status } : {};

        lastOutcome = { scenario: fixture.scenario, action, ok: false, code, errorName, ...providerDetails };

        try { await summary(fixture); } catch { /* Keep the response sanitized even if evidence cannot be read. */ }

        return send(response, 400, { code, errorName, ...providerDetails });

    } finally { if (ownsOperation) operationBusy = false; }

});



server.listen(4191, "127.0.0.1", () => console.log(`Real Razorpay TEST harness ready at ${origin}; synthetic isolated data only; provider writes require a browser action.`));

server.on("error", () => { console.error("Test harness could not bind its loopback port."); process.exitCode = 1; });

for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {

    server.close(() => { void prisma.$disconnect().finally(() => process.exit(0)); });

});

process.on("unhandledRejection", () => { console.error("Unhandled Test harness operation; details suppressed."); });
