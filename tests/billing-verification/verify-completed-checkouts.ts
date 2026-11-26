
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prisma } from "../../lib/prisma";

export async function verifyCompletedCheckouts(fixtures: Record<string, { ownerId: string; orgId: string; scenario: string }>) {
    const inspection = JSON.parse(readFileSync("test-results/billing-verification/three-plan-real-test-provider-inspection.json", "utf8"));
    assert.equal(inspection.readOnly, true);
    assert.ok(Date.now() - Date.parse(inspection.observedAt) < 30 * 60_000);
    const expected = {
        basic: {source:"BASIC",target:"STANDARD",amount:9900},
        standard: {source:"STANDARD",target:"PRO",amount:29900},
        pro: {source:"PRO",target:"BASIC",amount:49900},
    };
    for (const scenario of ["basic","standard","pro"] as const) {
        const {orgId} = fixtures[scenario];
        const e = expected[scenario];
        const phases = JSON.parse(readFileSync(`test-results/billing-verification/three-plan-real-test-phases-${scenario}.json`,"utf8")) as Array<{current:{plan:string;status:string}|null;changes:unknown[];access:{effectivePlan:string};featureAssertions:Array<{entitlement:string;allowed:boolean}>}>;
        const initial = phases.find(p=>p.current?.plan===e.source && p.current.status==="ACTIVE" && p.changes.length===1);
        assert.ok(initial);
        assert.equal(initial.access.effectivePlan,e.source);
        for (const f of initial.featureAssertions) assert.equal(f.allowed,f.entitlement==="WHATSAPP_AUTOMATION"?scenario==="pro":scenario!=="basic");
        const source = await prisma.organizationSubscription.findUniqueOrThrow({where:{currentOrganizationId:orgId}});
        assert.equal(source.plan,e.source); assert.equal(source.quantity,1); assert.equal(source.providerMode,"TEST");
        const changes=await prisma.organizationBillingChange.findMany({where:{organizationId:orgId},orderBy:{sequence:"asc"}});
        assert.equal(changes.length,2);
        const change=changes[1];
        assert.equal(change.toPlan,e.target); assert.equal(change.status,"SCHEDULED");
        const provider=inspection.fixtures.find((f:{scenario:string})=>f.scenario===scenario);
        const paid=provider.subscriptions.find((s:{localSubscriptionId:string})=>s.localSubscriptionId===source.id);
        assert.equal(paid.provider.value.status,"active");
        assert.equal(paid.provider.value.paid_count,1);
        assert.equal(paid.invoices.items.length,1);
        assert.equal(paid.invoices.items[0].amount_paid,e.amount);
        const candidate=provider.subscriptions.find((s:{localSubscriptionId:string})=>s.localSubscriptionId===change.replacementSubscriptionId);
        assert.equal(candidate.provider.value.status,"authenticated"); assert.equal(candidate.provider.value.paid_count,0);
        const paidInvoice = await prisma.organizationSubscriptionInvoice.findUniqueOrThrow({
            where: { razorpayInvoiceId: paid.invoices.items[0].id },
        });
        assert.equal(paidInvoice.organizationSubscriptionId, source.id);
        assert.equal(paidInvoice.organizationId, orgId);
        assert.equal(paidInvoice.razorpayPaymentId, paid.invoices.items[0].payment_id);
        assert.equal(paidInvoice.amountPaidSubunits, e.amount);
        assert.equal(change.failureCategory, null);
    }
}
