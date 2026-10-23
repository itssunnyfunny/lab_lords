/** Plans only. No subscriptions, mandates, invoices, captures or database writes. */
import { existsSync, readFileSync, writeFileSync, mkdirSync, openSync, closeSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { BILLING_PLAN_IDS, getActiveBillingPlan } from "../../lib/billingPlans";
import type { RazorpayPlanCatalogEntry, RazorpayPlanCatalogStore } from "../../services/razorpayPlanCatalog.service";

async function main() {
  if (process.argv.slice(2).some(arg => arg !== "--verify-discovery")) throw new Error("Unsupported argument");
  const discoveryOnly = process.argv.includes("--verify-discovery");
  const names = new Set(["RAZORPAY_MODE", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_TEST_KEY_ID", "RAZORPAY_TEST_KEY_SECRET"]);
  const credentials: Record<string, string> = {};
  const credentialRoot = resolve(process.env.BILLING_TEST_CREDENTIAL_DIR || process.cwd());
  for (const filename of [".env", ".env.local"]) {
    const path = resolve(credentialRoot, filename);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (!match || !names.has(match[1])) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      else value = value.replace(/\s+#.*$/, "").trim();
      credentials[match[1]] = value;
    }
  }
  const explicit = credentials.RAZORPAY_TEST_KEY_ID && credentials.RAZORPAY_TEST_KEY_SECRET;
  const key = explicit ? credentials.RAZORPAY_TEST_KEY_ID : credentials.RAZORPAY_KEY_ID;
  const secret = explicit ? credentials.RAZORPAY_TEST_KEY_SECRET : credentials.RAZORPAY_KEY_SECRET;
  if (!key?.startsWith("rzp_test_") || !secret || (!explicit && credentials.RAZORPAY_MODE !== "TEST")) throw new Error("Explicit Test credentials required; Live is refused");
  // Do not inherit database URLs or other credentials. The production catalogue
  // service receives a local journal store; its Prisma store is never invoked.
  for (const name of Object.keys(process.env)) if (/RAZORPAY|DATABASE_URL|DIRECT_URL|ACCELERATE_URL/.test(name)) delete process.env[name];
  Object.assign(process.env, { NODE_ENV: "test", VERCEL_ENV: "development", RAZORPAY_MODE: "TEST", RAZORPAY_KEY_ID: key, RAZORPAY_KEY_SECRET: secret, DATABASE_URL: "postgresql://invalid@127.0.0.1:1/no_connection_test" });
  const { ensureRazorpayPlanCatalogEntry } = await import("../../services/razorpayPlanCatalog.service");
  const { getRazorpayPlanCatalogClient } = await import("../../lib/razorpay");
  const api = getRazorpayPlanCatalogClient();
  const directory = "test-results/billing-verification";
  mkdirSync(directory, { recursive: true });
  const journalPath = `${directory}/three-plan-test-${discoveryOnly ? "discovery" : "mappings"}.json`;
  const lock = `${journalPath}.lock`;
  const fd = openSync(lock, "wx");
  try {
    const entries: RazorpayPlanCatalogEntry[] = !discoveryOnly && existsSync(journalPath) ? JSON.parse(readFileSync(journalPath, "utf8")).entries : [];
    if (entries.some(e => e.providerMode !== "TEST" || !e.catalogKey.startsWith("razorpay-plan:v2:TEST:"))) throw new Error("Invalid Test-only mapping journal");
    let creates = 0;
    const persist = () => writeFileSync(journalPath, JSON.stringify({ mode: "TEST", checkedAt: new Date().toISOString(), providerPlanCreatesThisRun: creates, subscriptionWrites: 0, databaseWrites: 0, entries }, null, 2));
    const store: RazorpayPlanCatalogStore = {
      async findActive(input) { return entries.find(e => e.active && e.catalogKey === input.catalogKey) ?? null; },
      async markVerified(id, at) { const e = entries.find(e => e.id === id)!; e.lastProviderVerifiedAt = at; persist(); return e; },
      async deactivate(id) { entries.find(e => e.id === id)!.active = false; persist(); },
      // Always scan provider notes first, including after a lost create response.
      async claimProvisioning(input) { return { claimed: true, leaseToken: input.leaseToken, attemptCount: 1 }; },
      async findProvisioning() { return null; },
      async completeProvisioning(input) { const e = { ...input, id: input.razorpayPlanId, active: true, lastProviderVerifiedAt: input.verifiedAt, createdAt: new Date(), updatedAt: new Date() }; entries.push(e); persist(); return e; },
      async failProvisioning() { persist(); },
    };
    const razorpay = {
      createPlan: async (input: Parameters<typeof api.createPlan>[0]) => { if (discoveryOnly) throw new Error("Read-only discovery cannot create plans"); creates++; return api.createPlan(input); },
      fetchPlan: (id: string) => api.fetchPlan(id),
      listPlans: (input: { count?: number; skip?: number }) => api.listPlans(input),
    };
    for (const id of BILLING_PLAN_IDS) {
      const plan = getActiveBillingPlan(id);
      const definition = { plan: id, name: plan.name, description: plan.description, amount: plan.amount!, currency: plan.currency, period: plan.period, interval: plan.interval };
      const first = await ensureRazorpayPlanCatalogEntry(definition, { store, razorpay });
      const second = await ensureRazorpayPlanCatalogEntry(definition, { store, razorpay });
      if (first.razorpayPlanId !== second.razorpayPlanId) throw new Error("Provider mapping replay changed identity");
      console.log(`${id}: verified ${first.amountSubunits} paise INR monthly interval 1; mapping reused on second read`);
    }
    persist();
    console.log(`Test provider plans ready: ${creates} plans created; zero subscription or payment writes.`);
  } finally { closeSync(fd); unlinkSync(lock); }
}
main().catch(() => { console.error("Test plan preparation failed; provider error details suppressed. Inspect configuration or the safe mapping journal."); process.exitCode = 1; });
