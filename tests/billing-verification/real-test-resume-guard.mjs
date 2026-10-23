export function validateResumeProof(proof, containerId) {
    if (!proof || !/^lab_lords_billing_real_[a-f0-9]{12}_browser_test$/.test(proof.database)
        || proof.containerId !== containerId || proof.schemaOnly !== true || proof.emptyBeforeSeed !== true
        || proof.mode !== "TEST" || proof.provider !== "real Razorpay Test API" || proof.startupProviderMutations !== 0) {
        throw new Error("The original real Test database proof is missing or does not match the verified container.");
    }
    return proof.database;
}

// Diagnostic text only: never serialize provider requests/responses or retain
// credentials, identifiers, contacts, or arbitrary long token-like values.
export function sanitizeStoredTestError(value, sensitiveValues = []) {
    if (typeof value !== "string" || !value.trim()) return null;
    if (/^\s*[\[{]/.test(value)) return "Structured error content suppressed.";
    let safe = value.slice(0, 4096);
    for (const secret of sensitiveValues) {
        if (typeof secret === "string" && secret) safe = safe.split(secret).join("[redacted]");
    }
    return safe
        .replace(/https?:\/\/[^\s<>"']+/gi, "[url]")
        .replace(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
        .replace(/\b(?:rzp_test|rzp_live|sub|pay|plan|inv|order|cus|offer|token|card|mandate)_[A-Z0-9_]+\b/gi, "[provider-id]")
        .replace(/\b(?:bearer|basic)\s+[A-Z0-9+/_=.-]+/gi, "[authorization]")
        .replace(/\b(?:api[_ -]?key|secret|signature|token|password)\s*[:=]\s*[^\s,;]+/gi, "[credential]")
        .replace(/\b(?=[A-Z0-9_+/.=-]{24,}\b)(?=[A-Z0-9_+/.=-]*[0-9])[A-Z0-9_+/.=-]+/gi, "[token]")
        .replace(/(?:\+?\d[\d ()-]{5,}\d)/g, "[number]")
        .replace(/[\r\n\t\u0000-\u001f]+/g, " ")
        .replace(/\s+/g, " ").trim().slice(0, 300);
}

export function basicRetestIdentity(fixtures) {
    const standard = fixtures.standard;
    const suffix = standard?.orgId?.match(/^billing_real_org_standard_([a-f0-9]{12})$/)?.[1];
    if (!suffix || standard.ownerId !== `billing_real_owner_standard_${suffix}`
        || fixtures.basic?.orgId !== `billing_real_org_basic_${suffix}`
        || fixtures.basic?.ownerId !== `billing_real_owner_basic_${suffix}`) {
        throw new Error("The original fixture pair is required before adding a retest workspace.");
    }
    return { scenario: "basic-retest", ownerId: `billing_real_owner_basic_retest_${suffix}`,
        orgId: `billing_real_org_basic_retest_${suffix}`, branchId: `billing_real_branch_basic_retest_${suffix}`,
        email: `billing-test-basic-retest-${suffix}@example.com` };
}

export function validateSyntheticRows(database, rows, catalogVersion = 1) {
    const fixtureCount = rows.organizations?.length;
    if (!/^lab_lords_billing_real_[a-f0-9]{12}_browser_test$/.test(database)
        || rows.identity?.[0]?.name !== database || ![2, 3].includes(fixtureCount)
        || rows.users?.length !== fixtureCount || rows.branches?.length !== fixtureCount
        || Number(rows.trials?.[0]?.count) !== 0) {
        throw new Error("Resume requires the original synthetic pair and at most its exact optional retest fixture.");
    }
    const standard = rows.organizations.find(org => /^billing_real_org_standard_[a-f0-9]{12}$/.test(org.id));
    if (!standard) throw new Error("Synthetic fixture identity is not recognized.");
    const suffix = standard.id.slice("billing_real_org_standard_".length);
    const fixtures = {};
    if (catalogVersion === 2 && fixtureCount !== 3) throw new Error("Catalogue v2 requires exactly three synthetic fixtures.");
    const scenarios = catalogVersion === 2 ? ["standard", "basic", "pro"] : fixtureCount === 3 ? ["standard", "basic", "basic-retest"] : ["standard", "basic"];
    for (const scenario of scenarios) {
        const identityName = scenario.replace("-", "_");
        const orgId = `billing_real_org_${identityName}_${suffix}`;
        const ownerId = `billing_real_owner_${identityName}_${suffix}`;
        const organization = rows.organizations.find(org => org.id === orgId);
        const owner = rows.users.find(user => user.id === ownerId);
        const branches = rows.branches.filter(branch => branch.organizationId === orgId);
        if (!organization || organization.ownerId !== ownerId || organization.billingModelVersion !== "WORKSPACE_V2"
            || organization.name !== "Synthetic Razorpay Test Workspace" || !owner || owner.clerkId != null
            || owner.name !== "Synthetic Billing Owner" || owner.email !== `billing-test-${scenario}-${suffix}@example.com`
            || branches.length !== 1 || branches[0].name !== "Synthetic Test Branch"
            || (scenario === "basic-retest" && branches[0].id !== `billing_real_branch_basic_retest_${suffix}`)) {
            throw new Error("Existing database rows do not match the original synthetic fixture identities.");
        }
        fixtures[scenario] = { scenario, ownerId, orgId };
    }
    if (fixtures["basic-retest"]) basicRetestIdentity(fixtures);
    const orgIds = new Set(Object.values(fixtures).map(fixture => fixture.orgId));
    for (const row of [...rows.subscriptions, ...rows.actions, ...rows.invoices]) {
        if (!orgIds.has(row.organizationId) || row.providerMode !== "TEST") throw new Error("Resume refuses foreign or non-Test billing rows.");
    }
    if (rows.plans.some(row => row.providerMode !== "TEST")) throw new Error("Resume refuses a non-Test plan catalogue.");
    return fixtures;
}

// Every query is a fixed read-only statement; callers must first verify the
// loopback container and original proof. No user-supplied SQL or schema writes.
export async function readVerifiedSyntheticFixtures(database, query, catalogVersion = 1) {
    const rows = {};
    for (const [key, sql] of Object.entries({
        identity: "SELECT current_database() AS name",
        users: 'SELECT id, "clerkId", email, name FROM "User"',
        organizations: 'SELECT id, "ownerId", "billingModelVersion", name FROM "Organization"',
        branches: 'SELECT id, "organizationId", name FROM "Branch"',
        trials: 'SELECT count(*)::int AS count FROM "OwnerTrialGrant"',
        subscriptions: 'SELECT "organizationId", "providerMode" FROM "OrganizationSubscription"',
        actions: 'SELECT "organizationId", "providerMode" FROM "BillingProviderAction"',
        invoices: 'SELECT "organizationId", "providerMode" FROM "OrganizationSubscriptionInvoice"',
        plans: 'SELECT "providerMode" FROM "SaasRazorpayPlan"',
    })) rows[key] = await query(sql);
    return validateSyntheticRows(database, rows, catalogVersion);
}
