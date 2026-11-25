/** Real Razorpay TEST, pre-authorization only. Run after migrating a new local
 * template0 database named lab_lords_branch_plans_preauth_test. --serve opens a
 * loopback-only test server for manual authorization of the original operations. --inspect
 * re-fetches and reconciles the same subscriptions, including provider expiry.
 * Never reuse a shared database. Preserve this database across both commands. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readTestCredentials } from "./test-credentials.mjs";

const plans = ["BASIC", "STANDARD", "PRO"] as const;
const database = "lab_lords_branch_plans_preauth_test";
const args = process.argv.slice(2);
const prepare = args[0] === "--prepare";
const serve = args[0] === "--serve";
let stage = "target";
const trace: { method: string; resource: string; status: number }[] = [];
function check(ok: unknown, reason: string): asserts ok {
  if (!ok) throw new Error("Guard: " + reason);
}

async function main() {
  check(args.length === 1 && (prepare || serve || args[0] === "--inspect"), "use --prepare, --inspect or --serve");
  const containerId = process.env.BILLING_REAL_TEST_CONTAINER_ID;
  const port = process.env.BILLING_REAL_TEST_PORT;
  check(containerId && /^[a-f0-9]{64}$/.test(containerId) && port && /^\d{4,5}$/.test(port), "container identity required");
  const target = `postgresql://postgres@127.0.0.1:${port}/${database}`;
  check(process.env.DATABASE_URL === target && process.env.DIRECT_URL === target && process.env.TEST_DATABASE_URL === target
    && !process.env.ACCELERATE_URL && process.env.TEST_DATABASE_RESET_CONFIRM === database
    && process.env.VERCEL_ENV === "development" && process.env.RAZORPAY_MODE === "TEST", "isolated Test target required");
  const docker = (parameters: string[]) => execFileSync("docker", parameters, {
    encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  check(docker(["inspect", containerId, "--format", "{{.Id}} {{.Config.Image}} {{.State.Running}}"]) === `${containerId} postgres:16-alpine true`
    && docker(["port", containerId, "5432/tcp"]) === `127.0.0.1:${port}`, "container binding changed");
  const credentials = readTestCredentials();
  for (const name of Object.keys(process.env)) if (name.startsWith("RAZORPAY_")) delete process.env[name];
  Object.assign(process.env, { NODE_ENV: "test", RAZORPAY_MODE: "TEST", RAZORPAY_KEY_ID: credentials.keyId,
    RAZORPAY_KEY_SECRET: credentials.keySecret, RAZORPAY_BILLING_WRITES_ENABLED: prepare ? "true" : "false" });
  // Suppress potentially sensitive application diagnostics. Only this harness's
  // fixed labels, HTTP status codes and verified aggregate facts reach stdout.
  console.warn = console.error = console.log = () => {};
  const { prisma } = await import("../../lib/prisma");
  try {
    const identity = await prisma.$queryRaw<Array<{ database: string; identity: string }>>`
      SELECT current_database() AS database, identity::text FROM "BillingDatabaseIdentity" WHERE id=1`;
    check(identity.length === 1 && identity[0].database === database, "database identity changed");
    const suffix = createHash("sha256").update(identity[0].identity).digest("hex").slice(0, 12);
    const ownerId = "test_preauth_owner_" + suffix, organizationId = "test_preauth_org_" + suffix;
    const branchFor = (plan: string) => "test_preauth_" + plan.toLowerCase() + "_" + suffix;
    const counts = await Promise.all([prisma.user.count(), prisma.organization.count(), prisma.branch.count(), prisma.ownerTrialGrant.count()]);
    if (prepare && counts.every(n => n === 0)) {
      await prisma.$transaction(async tx => {
        await tx.user.create({ data: { id: ownerId, email: `test-preauth-${suffix}@example.invalid`, name: "Synthetic Test Owner" } });
        await tx.organization.create({ data: { id: organizationId, ownerId, name: "Synthetic Test Workspace", billingModelVersion: "BRANCH_V3" } });
        for (const plan of plans) {
          const id = branchFor(plan);
          await tx.branch.create({ data: { id, organizationId, name: "Synthetic " + plan, billingStatus: "PENDING_ACTIVATION" } });
          await tx.branchBillingAgreement.create({ data: { branchId: id, organizationId, selectedPlan: plan } });
        }
      });
    }
    const fixtures = await prisma.organization.findMany({ include: { owner: true, branches: { include: { billingAgreement: true } } } });
    check(fixtures.length === 1 && fixtures[0].id === organizationId && fixtures[0].owner.id === ownerId
      && fixtures[0].owner.email === `test-preauth-${suffix}@example.invalid` && fixtures[0].billingModelVersion === "BRANCH_V3"
      && await prisma.user.count() === 1 && await prisma.branch.count() === 3 && await prisma.ownerTrialGrant.count() === 0
      && fixtures[0].branches.length === 3 && plans.every(plan => fixtures[0].branches.some(b =>
        b.id === branchFor(plan) && (b.billingStatus === "PENDING_ACTIVATION" || (!prepare && b.billingStatus === "ACTIVE")) && b.billingAgreement?.selectedPlan === plan)),
      "exact synthetic fixtures required");
    const { BillingService } = await import("../../services/billing.service");
    const { withOwnerBillingScope } = await import("../../services/billingAgreementScope.service");
    const { BillingReconciliationService } = await import("../../services/billingReconciliation.service");
    const { EntitlementService } = await import("../../services/entitlement.service");
    const { getRazorpayClient, getRazorpayPlanCatalogClient, resolveRazorpayMode } = await import("../../lib/razorpay");
    check(resolveRazorpayMode() === "TEST", "Test mode required");
    const api = getRazorpayClient();
    const nativeFetch = globalThis.fetch;
    let activePlan: typeof plans[number] = "BASIC";
    const attempted = new Set<string>();
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input)), method = init?.method ?? "GET", resource = url.pathname.split("/")[2];
      check(url.origin === "https://api.razorpay.com" && url.pathname.startsWith("/v1/"), "official API required");
      if (method === "POST") {
        const body = JSON.parse(String(init?.body));
        check(prepare && ["/v1/plans", "/v1/subscriptions"].includes(url.pathname) && body.notes?.provider_mode === "TEST"
          && body.notes.plan === activePlan && !attempted.has(resource + activePlan), "unexpected provider write");
        check(resource !== "subscriptions" || (body.quantity === 1 && !body.notify_info && !body.customer_id
          && body.notes.organization_id === organizationId && body.notes.branch_agreement_id === branchFor(activePlan)
          && body.notes.billing_model_version === "BRANCH_V3"), "wrong branch subscription");
        attempted.add(resource + activePlan);
      } else {
        check(method === "GET" && ["plans", "subscriptions", "invoices", "payments"].includes(resource), "unexpected provider request");
      }
      const response = await nativeFetch(input, { ...init, redirect: "error" }).catch(() => {
        trace.push({ method, resource, status: 0 });
        throw new Error("Guard: provider network failure");
      });
      trace.push({ method, resource, status: response.status });
      return response;
    };
    try {
      for (const plan of plans) {
        activePlan = plan;
        const branchId = branchFor(plan);
        const scope = <T>(work: () => Promise<T>) => withOwnerBillingScope(ownerId, organizationId, branchId, work);
        const where = { organizationId, agreementBranchId: branchId };
        stage = plan + " fixtures";
        const existing = await prisma.organizationSubscription.findMany({ where });
        const priorActions = await prisma.billingProviderAction.findMany({ where });
        check(existing.length <= 1 && priorActions.length <= 1, "unexpected previous billing history");
        let subId = existing[0]?.razorpaySubscriptionId;
        if (prepare) {
          check(!priorActions.length || (!!subId && priorActions[0].status === "CONFIRMED"), "unresolved prior dispatch requires read-only review");
          if (priorActions.length) {
            attempted.add("subscriptions" + activePlan);
            const original = await api.fetchSubscription(subId!);
            check(original.status === "created" && original.paid_count === 0 && original.expire_by && original.expire_by * 1000 > Date.now(),
              "existing checkout is no longer reusable; use --inspect");
          }
          stage = plan + " checkout";
          const start = () => scope(() => BillingService.createSubscriptionCheckout(ownerId, organizationId, { plan }));
          const first = await start();
          check(first.testMode && first.summary.quantity === 1 && first.notes.branch_agreement_id === branchId && (!subId || subId === first.subscriptionId), "wrong checkout scope");
          const second = await start();
          check(first.changeId === second.changeId && first.subscriptionId === second.subscriptionId, "replay changed identity");
          subId = first.subscriptionId;
        }
        check(subId, "subscription unavailable");
        stage = plan + " provider readback";
        const sub = await api.fetchSubscription(subId);
        const local = await prisma.organizationSubscription.findFirstOrThrow({ where: { ...where, razorpaySubscriptionId: subId } });
        const actions = await prisma.billingProviderAction.findMany({ where });
        const mapping = await prisma.saasRazorpayPlan.findUniqueOrThrow({ where: { razorpayPlanId: sub.plan_id } });
        const providerPlan = await getRazorpayPlanCatalogClient().fetchPlan(sub.plan_id);
        const unpaid = ["created", "expired"].includes(sub.status) && sub.paid_count === 0 && !sub.payment_method;
        check(sub.quantity === 1 && (prepare ? unpaid : ["created", "expired", "authenticated", "active", "pending", "halted", "cancelled", "completed"].includes(sub.status))
          && sub.notes?.organization_id === organizationId && sub.notes?.branch_agreement_id === branchId
          && sub.notes?.provider_mode === "TEST" && sub.notes?.plan === plan && local.currentAgreementBranchId === branchId
          && local.providerMode === "TEST" && local.plan === plan && mapping.providerMode === "TEST" && mapping.plan === plan
          && mapping.amountSubunits === providerPlan.item?.amount && providerPlan.item.currency === "INR" && providerPlan.period === "monthly"
          && providerPlan.interval === 1 && actions.length === 1 && actions[0].status === "CONFIRMED"
          && actions[0].providerMode === "TEST" && actions[0].changeId === sub.notes.billing_change_id, "provider binding mismatch");
        stage = plan + " reconciliation";
        const result = await scope(() => BillingReconciliationService.reconcileProviderSubscription(sub.id));
        const writable = (await EntitlementService.getBranchProfile(branchId)).canWrite;
        check(!unpaid || !writable, "unpaid branch gained access");
        process.stdout.write(JSON.stringify({ plan, subunits: mapping.amountSubunits, quantity: 1, mode: "TEST", status: sub.status,
          paidCount: sub.paid_count, evidenceKind: result.evidenceKind, scopeVerified: true, checkoutReplayVerified: prepare, distinctCreateActions: actions.length, writable,
          expiresAt: sub.expire_by ? new Date(sub.expire_by * 1000).toISOString() : null }) + "\n");
      }
      if (serve) {
        const { serveOriginalCheckouts } = await import("./branch-checkout-browser");
        await serveOriginalCheckouts({ ownerId, organizationId, plans, branchFor });
      }
    } finally { globalThis.fetch = nativeFetch; }
    check(await prisma.organizationSubscription.count() === 3 && await prisma.saasRazorpayPlan.count({ where: { providerMode: "TEST", active: true } }) === 3,
      "expected three independent subscriptions and catalogue entries");
    process.stdout.write(JSON.stringify({ verifiedAt: new Date().toISOString(),
      subscriptionPostCount: trace.filter(r => r.method === "POST" && r.resource === "subscriptions").length,
      planPostCount: trace.filter(r => r.method === "POST" && r.resource === "plans").length }) + "\n");
  } finally { await prisma.$disconnect(); }
}
main().catch(error => {
  const reason = error instanceof Error && error.message.startsWith("Guard: ") ? error.message : "service or provider failure";
  const lastRequest = trace.slice(-1)[0];
  const knownErrors = ["RazorpayApiError", "RazorpayPlanCatalogProvisioningError", "BillingManualReviewRequiredError", "PrismaClientKnownRequestError"];
  const errorType = error instanceof Error && knownErrors.includes(error.constructor.name) ? error.constructor.name : null;
  process.stderr.write(JSON.stringify({ stage, reason, lastRequest, errorType, providerWrites: trace.filter(r => r.method === "POST") }) + "\n");
  process.exitCode = 1;
});
