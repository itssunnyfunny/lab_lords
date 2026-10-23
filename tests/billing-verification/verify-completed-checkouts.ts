
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { prisma } from "../../lib/prisma";
import { BillingService } from "../../services/billing.service";
import { EntitlementService, SubscriptionEntitlementError } from "../../services/entitlement.service";

export async function verifyCompletedCheckouts(fixtures: Record<string, { ownerId: string; orgId: string; scenario: string }>) {
    const inspection = JSON.parse(readFileSync("test-results/billing-verification/three-plan-real-test-provider-inspection.json", "utf8"));
    assert.equal(inspection.readOnly, true);
    assert.ok(Date.now() - Date.parse(inspection.observedAt) < 30 * 60_000);
    const results = [];
    const expected = {
        basic: {source:"BASIC",target:"STANDARD",amount:9900,access:"STANDARD"},
        standard: {source:"STANDARD",target:"PRO",amount:29900,access:"PRO"},
        pro: {source:"PRO",target:"BASIC",amount:49900,access:"PRO"},
    };
    for (const scenario of ["basic","standard","pro"] as const) {
        const {ownerId,orgId} = fixtures[scenario];
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
        const actionCount=await prisma.billingProviderAction.count({where:{organizationId:orgId}});
        await BillingService.retryBillingOperation(ownerId,orgId,change.id);
        await BillingService.retryBillingOperation(ownerId,orgId,change.id);
        await BillingService.reconcileMutation(ownerId,orgId,change.id);
        await BillingService.changeWorkspacePlan(ownerId,orgId,e.target,change.idempotencyKey,`/org/${orgId}/billing`);
        assert.equal(await prisma.billingProviderAction.count({where:{organizationId:orgId}}),actionCount);
        assert.equal(await prisma.organizationBillingChange.count({where:{organizationId:orgId}}),2);
        assert.equal(await prisma.organizationSubscription.count({where:{organizationId:orgId}}),2);
        assert.equal(await prisma.organizationSubscriptionInvoice.count({where:{organizationId:orgId}}),1);
        const after=await prisma.organizationSubscription.findUniqueOrThrow({where:{currentOrganizationId:orgId}});
        assert.equal(after.id,source.id); assert.equal(after.paidThrough?.getTime(),source.paidThrough?.getTime());
        const recovered=await prisma.organizationBillingChange.findUniqueOrThrow({where:{id:change.id}});
        assert.equal(recovered.status,"SCHEDULED"); assert.equal(recovered.failureCategory,null);
        assert.equal(recovered.replacementSubscriptionId,change.replacementSubscriptionId);
        const profile=await EntitlementService.getOrganizationProfile(orgId);
        assert.equal(profile.effectivePlan,e.access); assert.equal(profile.canWrite,true);
        const features=[];
        for (const entitlement of ["STAFF_MANAGEMENT","ADVANCED_ANALYTICS","AI_ACCESS","WHATSAPP_AUTOMATION"] as const) {
            let allowed=true;
            try {await EntitlementService.assertOrganizationEntitlement(orgId,entitlement);}
            catch(error) {if (!(error instanceof SubscriptionEntitlementError)) throw error; allowed=false;}
            assert.equal(allowed,entitlement!=="WHATSAPP_AUTOMATION" || e.access==="PRO");
            features.push({entitlement,allowed});
        }
        results.push({scenario,paidAmountSubunits:e.amount,sourcePlan:e.source,targetPlan:e.target,effectiveAccess:profile.effectivePlan,
            initialFeatureGatesPassed:true,features,recoveryReentryAttempts:2,sameKeyPlanChangeAfterRecoveryPassed:true,
            sourcePaidPeriodPreserved:true,providerActions:actionCount,subscriptions:2,invoices:1,effectiveAt:change.effectiveAt});
    }
    writeFileSync("test-results/billing-verification/three-plan-real-test-completed.json",JSON.stringify({
        observedAt:new Date().toISOString(),mode:"TEST",providerWritesBlocked:true,results,
        scope:"Actual paid checkout, replacement authorization, recovery re-entry and exact-key replay. No injected transport loss, new post-undo mandate, future settlement or public webhook delivery in this run."
    },null,2));
}
