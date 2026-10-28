import { describe, expect, it } from "vitest";
import { basicRetestIdentity, sanitizeStoredTestError, validateResumeProof, validateSyntheticRows } from "@/tests/billing-verification/real-test-resume-guard.mjs";

const database = "lab_lords_billing_real_012345abcdef_browser_test";
const containerId = "a".repeat(64);
const proof = { database, containerId, schemaOnly: true, emptyBeforeSeed: true, mode: "TEST", provider: "real Razorpay Test API", startupProviderMutations: 0 };
function rows(includeRetest = false) {
    const scenarios = includeRetest ? ["standard", "basic", "basic-retest"] : ["standard", "basic"];
    return {
        identity: [{ name: database }], trials: [{ count: 0 }],
        users: scenarios.map(scenario => ({ id: `billing_real_owner_${scenario.replace("-", "_")}_abcdef012345`, clerkId: null, name: "Synthetic Billing Owner", email: `billing-test-${scenario}-abcdef012345@example.com` })),
        organizations: scenarios.map(scenario => ({ id: `billing_real_org_${scenario.replace("-", "_")}_abcdef012345`, ownerId: `billing_real_owner_${scenario.replace("-", "_")}_abcdef012345`, name: "Synthetic Razorpay Test Workspace", billingModelVersion: "WORKSPACE_V2" })),
        branches: scenarios.map(scenario => ({ id: `billing_real_branch_${scenario.replace("-", "_")}_abcdef012345`, organizationId: `billing_real_org_${scenario.replace("-", "_")}_abcdef012345`, name: "Synthetic Test Branch" })),
        subscriptions: [{ organizationId: "billing_real_org_standard_abcdef012345", providerMode: "TEST" }],
        actions: [] as Array<{ organizationId: string; providerMode: string }>, invoices: [], plans: [{ providerMode: "TEST" }],
    };
}

describe("real Test harness resume guards", () => {
    it("redacts sensitive stored-error fields and bounds diagnostic text", () => {
        const redacted = sanitizeStoredTestError("Cannot update sub_123ABCD: owner@example.com +91 98765 43210 https://api.example.com/private rzp_test_fakekey secret=sampleSecret shortSecret abcdefghijklmnopqr1234567890", ["shortSecret"]);
        expect(redacted).toBe("Cannot update [provider-id]: [email] [number] [url] [provider-id] [credential] [redacted] [token]");
        expect(sanitizeStoredTestError('{"raw":"body"}')).toBe("Structured error content suppressed.");
        expect(sanitizeStoredTestError("x".repeat(500))).toHaveLength(300);
        expect(sanitizeStoredTestError(null)).toBeNull();
        expect(sanitizeStoredTestError("Subscription cannot be updated after a test payment.")).toBe("Subscription cannot be updated after a test payment.");
    });

    it("accepts only the original container proof and exact two synthetic fixtures", () => {
        expect(validateResumeProof(proof, containerId)).toBe(database);
        expect(validateSyntheticRows(database, rows())).toEqual({
            standard: { scenario: "standard", ownerId: "billing_real_owner_standard_abcdef012345", orgId: "billing_real_org_standard_abcdef012345" },
            basic: { scenario: "basic", ownerId: "billing_real_owner_basic_abcdef012345", orgId: "billing_real_org_basic_abcdef012345" },
        });
    });

    it("rejects replacement proof, shared targets and missing original isolation evidence", () => {
        expect(() => validateResumeProof(proof, "b".repeat(64))).toThrow();
        expect(() => validateResumeProof({ ...proof, database: "lab_lords_production" }, containerId)).toThrow();
        expect(() => validateResumeProof({ ...proof, emptyBeforeSeed: false }, containerId)).toThrow();
        expect(() => validateResumeProof({ ...proof, mode: "LIVE" }, containerId)).toThrow();
    });

    it("rejects another user, organization, branch or reassigned synthetic owner", () => {
        const extraUser = rows(); extraUser.users.push({ ...extraUser.users[0], id: "another-user" });
        expect(() => validateSyntheticRows(database, extraUser)).toThrow();
        const changedOwner = rows(); changedOwner.organizations[0].ownerId = changedOwner.users[1].id;
        expect(() => validateSyntheticRows(database, changedOwner)).toThrow();
        const changedBranch = rows(); changedBranch.branches[1].organizationId = changedBranch.organizations[0].id;
        expect(() => validateSyntheticRows(database, changedBranch)).toThrow();
        const personalEmail = rows(); personalEmail.users[0].email = "someone@example.com";
        expect(() => validateSyntheticRows(database, personalEmail)).toThrow();
    });

    it("rejects any non-Test or foreign billing row and a different actual database", () => {
        const live = rows(); live.subscriptions[0].providerMode = "LIVE";
        expect(() => validateSyntheticRows(database, live)).toThrow();
        const foreign = rows(); foreign.actions.push({ organizationId: "foreign", providerMode: "TEST" });
        expect(() => validateSyntheticRows(database, foreign)).toThrow();
        const different = rows(); different.identity[0].name = "other_test";
        expect(() => validateSyntheticRows(database, different)).toThrow();
    });
});


describe("optional exact Basic retest fixture", () => {
    it("derives one stable fixture identity only from the verified original pair", () => {
        const original = validateSyntheticRows(database, rows()) as Record<string, { scenario: string; ownerId: string; orgId: string }>;
        expect(basicRetestIdentity(original)).toEqual({ scenario: "basic-retest",
            ownerId: "billing_real_owner_basic_retest_abcdef012345", orgId: "billing_real_org_basic_retest_abcdef012345",
            branchId: "billing_real_branch_basic_retest_abcdef012345", email: "billing-test-basic-retest-abcdef012345@example.com" });
        expect(() => basicRetestIdentity({ standard: original.standard })).toThrow();
        expect(() => basicRetestIdentity({ ...original, basic: { ...original.basic, ownerId: "foreign" } })).toThrow();
    });

    it("resumes the exact optional third fixture while retaining the original identities", () => {
        const original = validateSyntheticRows(database, rows()) as Record<string, { scenario: string; ownerId: string; orgId: string }>;
        const extended = validateSyntheticRows(database, rows(true)) as Record<string, { scenario: string; ownerId: string; orgId: string }>;
        expect(extended).toMatchObject(original);
        expect(extended["basic-retest"]).toEqual({ scenario: "basic-retest", ownerId: "billing_real_owner_basic_retest_abcdef012345", orgId: "billing_real_org_basic_retest_abcdef012345" });
    });

    it("does not accept an arbitrary third fixture or a fourth fixture", () => {
        const foreign = rows(true); foreign.organizations[2].id = "billing_real_org_basic_retest_111111111111";
        expect(() => validateSyntheticRows(database, foreign)).toThrow();
        const fourth = rows(true); fourth.organizations.push({ ...fourth.organizations[2], id: "another-org" });
        fourth.users.push({ ...fourth.users[2], id: "another-user" });
        fourth.branches.push({ ...fourth.branches[2], id: "another-branch" });
        expect(() => validateSyntheticRows(database, fourth)).toThrow();
    });

    it("requires the deterministic third branch, synthetic contact and matching owner", () => {
        const branch = rows(true); branch.branches[2].id = "different-branch";
        expect(() => validateSyntheticRows(database, branch)).toThrow();
        const owner = rows(true); owner.organizations[2].ownerId = owner.users[0].id;
        expect(() => validateSyntheticRows(database, owner)).toThrow();
        const email = rows(true); email.users[2].email = "someone@example.com";
        expect(() => validateSyntheticRows(database, email)).toThrow();
    });

    it("retains Test-mode and no-trial guards after the optional extension", () => {
        const live = rows(true); live.actions.push({ organizationId: live.organizations[2].id, providerMode: "LIVE" });
        expect(() => validateSyntheticRows(database, live)).toThrow();
        const trial = rows(true); trial.trials[0].count = 1;
        expect(() => validateSyntheticRows(database, trial)).toThrow();
        const partial = rows(true); partial.branches.pop();
        expect(() => validateSyntheticRows(database, partial)).toThrow();
    });
});

describe("catalogue v2 fixture isolation", () => {
    function threePlanRows() {
        return JSON.parse(JSON.stringify(rows(true)).replaceAll("basic_retest", "pro").replaceAll("basic-retest", "pro"));
    }
    it("accepts exactly Basic, Standard and Pro with no trial", () => {
        expect(Object.keys(validateSyntheticRows(database, threePlanRows(), 2)).sort()).toEqual(["basic", "pro", "standard"]);
    });
    it("rejects old catalogue fixture sets and a Live action", () => {
        expect(() => validateSyntheticRows(database, rows(), 2)).toThrow();
        expect(() => validateSyntheticRows(database, rows(true), 2)).toThrow();
        const live = threePlanRows();
        live.actions.push({ organizationId: live.organizations[2].id, providerMode: "LIVE" });
        expect(() => validateSyntheticRows(database, live, 2)).toThrow();
    });
    it("retains trial, ownership and foreign-row checks for Pro", () => {
        const trial = threePlanRows(); trial.trials[0].count = 1;
        expect(() => validateSyntheticRows(database, trial, 2)).toThrow();
        const owner = threePlanRows(); owner.organizations[2].ownerId = owner.users[0].id;
        expect(() => validateSyntheticRows(database, owner, 2)).toThrow();
        const foreign = threePlanRows(); foreign.actions.push({ organizationId: "foreign", providerMode: "TEST" });
        expect(() => validateSyntheticRows(database, foreign, 2)).toThrow();
    });
});
