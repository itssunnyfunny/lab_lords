import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import * as meta from "@/lib/metaWhatsApp";
import { WhatsAppConnectionService } from "@/services/whatsappConnection.service";
import { WhatsAppHealthService, type WhatsAppHealthProvider } from "@/services/whatsappHealth.service";
import { WhatsAppIncidentService } from "@/services/whatsappIncident.service";
import { WhatsAppMaintenanceService } from "@/services/whatsappMaintenance.service";
import { WhatsAppWebhookService } from "@/services/whatsappWebhook.service";
import { WhatsAppSenderService } from "@/services/whatsappSender.service";
import { createBranch, createOrg, createSaasSubscription, createUser } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";
import { restoreTime } from "@/tests/setup/time";

const NOW = new Date("2026-11-14T04:30:00Z");
const SECRET = "synthetic-whatsapp-audit-signing-secret";
const ENV = {
  NODE_ENV: "test", VERCEL_ENV: "preview", META_WHATSAPP_MODE: "TEST",
  WHATSAPP_INTEGRATION_ENABLED: "true", WHATSAPP_WEBHOOK_INGEST_ENABLED: "true",
  WHATSAPP_HEALTH_RECONCILIATION_ENABLED: "true", WHATSAPP_META_ONBOARDING_WRITES_ENABLED: "true",
  WHATSAPP_META_MESSAGE_WRITES_ENABLED: "true",
  META_GRAPH_API_VERSION: "v25.0", META_APP_ID: "10001", META_APP_SECRET: SECRET,
  META_EMBEDDED_SIGNUP_CONFIG_ID: "20002", META_BUSINESS_ID: "30003",
  META_SYSTEM_USER_ID: "40004", META_SYSTEM_USER_ACCESS_TOKEN: "synthetic-audit-token",
  META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: "synthetic-audit-verify",
  WHATSAPP_UTILITY_RATE_MICROS_INR: "800000", WHATSAPP_RATE_CARD_VERSION: "audit-v1",
  WHATSAPP_RATE_CARD_EFFECTIVE_AT: "2026-01-01T00:00:00Z",
  WHATSAPP_RATE_CARD_EXPIRES_AT: "2026-11-01T00:00:00Z",
} as const;
const WABA = { id: "50005", name: "Audit", currency: "INR", timezoneId: "Asia/Kolkata", accountMode: "SANDBOX" };
const PHONE = {
  id: "60006", wabaId: WABA.id, displayPhoneNumber: "+919000000000", verifiedName: "Audit",
  qualityRating: "GREEN", registrationStatus: "REGISTERED", status: "CONNECTED",
  codeVerificationStatus: "VERIFIED", platformType: "CLOUD_API",
};

beforeEach(async () => {
  await resetDatabase();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("External requests forbidden in audit tests"); }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); restoreTime(); });
afterAll(disconnectDatabase);

async function world() {
  const owner = await createUser();
  const org = await createOrg({ ownerId: owner.id });
  await createSaasSubscription({ organizationId: org.id, plan: "PRO" });
  const branch = await createBranch({ organizationId: org.id });
  const sender = await testPrisma.whatsAppSender.create({ data: {
    organizationId: org.id, provider: "META_CLOUD", providerMode: "TEST",
    wabaId: WABA.id, phoneNumberId: PHONE.id, displayPhoneNumber: PHONE.displayPhoneNumber,
    status: "ACTIVE",
  } });
  return { owner, org, branch, sender };
}

// Keep transactions and SQL real, but deterministically allow a second
// connection to win immediately before the worker's final conditional write.
function interceptWrite(
  model: "whatsAppSender" | "whatsAppConnectionIntent",
  hook: (args: { data: Record<string, unknown> }) => Promise<void>,
  afterHealthRead = false
) {
  const transaction = prisma.$transaction.bind(prisma);
  vi.spyOn(prisma, "$transaction").mockImplementation(((
    callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel }
  ) => transaction(async tx => callback(new Proxy(tx, {
    get(target, key) {
      if (key !== model) return Reflect.get(target, key);
      const delegate = target[model];
      return new Proxy(delegate, {
        get(delegateTarget, method) {
          const original = Reflect.get(delegateTarget, method);
          if (afterHealthRead && method === "findFirst") {
            return async (args: { include?: { safetyState?: boolean } }) => {
              const result = await Reflect.apply(original, delegateTarget, [args]);
              if (args.include?.safetyState) await hook({ data: {} });
              return result;
            };
          }
          if (method !== "updateMany" || afterHealthRead) return original;
          return async (args: { data: Record<string, unknown> }) => {
            await hook(args);
            return Reflect.apply(original, delegateTarget, [args]);
          };
        },
      });
    },
  })), options)) as typeof prisma.$transaction);
}

function healthProvider(): WhatsAppHealthProvider {
  return {
    fetchWaba: vi.fn().mockResolvedValue(WABA),
    fetchPhoneNumber: vi.fn().mockResolvedValue(PHONE),
    listSubscribedApps: vi.fn().mockResolvedValue([{ id: ENV.META_APP_ID, name: "Audit" }]),
    listMessageTemplates: vi.fn().mockResolvedValue([{
      id: "70007", name: "audit_template", language: "en", category: "UTILITY",
      status: "APPROVED", components: [],
    }]),
  };
}

describe("WhatsApp health lease finalization", () => {
  it("commits provider health and template evidence with a current lease", async () => {
    const { sender, owner, org } = await world();
    await WhatsAppHealthService.run({ invocationId: "audit-health-current", batchSize: 1, now: NOW, env: ENV, provider: healthProvider() });
    await expect(testPrisma.whatsAppSender.findUniqueOrThrow({ where: { id: sender.id } }))
      .resolves.toMatchObject({ status: "ACTIVE", lastHealthCheckAt: NOW, healthLeaseToken: null });
    expect(await testPrisma.whatsAppTemplate.count({ where: { senderId: sender.id } })).toBe(1);
    await WhatsAppSenderService.disconnectLocal({ actorUserId: owner.id, organizationId: org.id, senderId: sender.id });
    await expect(testPrisma.whatsAppSender.findUniqueOrThrow({ where: { id: sender.id } }))
      .resolves.toMatchObject({ status: "DISCONNECTED" });
  });

  it.each(["disconnect", "reclaim", "expire"] as const)("rolls back all success writes when %s wins after the initial read", async race => {
    const { sender } = await world();
    let raced = false;
    interceptWrite("whatsAppSender", async () => {
      if (raced) return;
      raced = true;
      await testPrisma.whatsAppSender.update({ where: { id: sender.id }, data: race === "disconnect"
        ? { status: "DISCONNECTED", disconnectedAt: NOW }
        : race === "expire" ? { healthLeaseUntil: new Date(NOW.getTime() - 1) }
        : { healthLeaseToken: "successor-health-lease", healthLeaseUntil: new Date(NOW.getTime() + 600_000) } });
    }, true);
    const result = await WhatsAppHealthService.run({ invocationId: `audit-health-${race}`, batchSize: 1, now: NOW, env: ENV, provider: healthProvider() });
    expect(raced).toBe(true);
    expect(result.counts).toMatchObject({ staleFinalizations: 1, templatesChanged: 0 });
    const persisted = await testPrisma.whatsAppSender.findUniqueOrThrow({ where: { id: sender.id } });
    expect(persisted.lastHealthCheckAt).toBeNull();
    if (race === "disconnect") expect(persisted.status).toBe("DISCONNECTED");
    if (race === "reclaim") expect(persisted.healthLeaseToken).toBe("successor-health-lease");
    expect(await testPrisma.whatsAppTemplate.count()).toBe(0);
    expect(await testPrisma.whatsAppSenderSafetyState.count()).toBe(0);
    expect(await testPrisma.whatsAppOperationalIncident.count()).toBe(0);
  });

  it("does not let a failed health read clear a successor's lease", async () => {
    const { sender } = await world();
    const provider = healthProvider();
    vi.mocked(provider.fetchWaba).mockRejectedValue(new Error("Synthetic provider failure"));
    interceptWrite("whatsAppSender", async ({ data }) => {
      if (!data.lastErrorCode) return;
      await testPrisma.whatsAppSender.update({ where: { id: sender.id }, data: {
        healthLeaseToken: "successor-failure-lease", healthLeaseUntil: new Date(NOW.getTime() + 600_000),
      } });
    });
    const result = await WhatsAppHealthService.run({ invocationId: "audit-health-failure", batchSize: 1, now: NOW, env: ENV, provider });
    expect(result.counts).toMatchObject({ staleFinalizations: 1 });
    await expect(testPrisma.whatsAppSender.findUniqueOrThrow({ where: { id: sender.id } }))
      .resolves.toMatchObject({ healthLeaseToken: "successor-failure-lease", lastErrorCode: null, lastHealthCheckAt: null });
  });
});

describe("WhatsApp onboarding final lease consumption", () => {
  it.each(["current", "reclaim", "expire"] as const)("handles a %s lease at the final commit", async race => {
    const { owner, org, sender } = await world();
    const provider = {
      exchangeEmbeddedSignupCode: vi.fn().mockResolvedValue({ accessToken: "synthetic-temporary-token" }),
      debugAccessToken: vi.fn().mockResolvedValue({
        appId: ENV.META_APP_ID, isValid: true, expiresAt: new Date(NOW.getTime() + 600_000),
        scopes: ["whatsapp_business_management", "whatsapp_business_messaging"],
        granularScopes: ["whatsapp_business_management", "whatsapp_business_messaging"].map(scope => ({ scope, targetIds: [WABA.id] })),
      }),
      listOrResolveSharedWabas: vi.fn().mockResolvedValue([WABA]),
      fetchWaba: vi.fn().mockResolvedValue(WABA), listPhoneNumbers: vi.fn().mockResolvedValue([PHONE]),
      fetchPhoneNumber: vi.fn().mockResolvedValue(PHONE),
      listAssignedSystemUsers: vi.fn().mockResolvedValue([{ id: ENV.META_SYSTEM_USER_ID, name: "Audit", tasks: ["MANAGE"] }]),
      listSubscribedApps: vi.fn().mockResolvedValue([{ id: ENV.META_APP_ID, name: "Audit" }]),
    };
    vi.spyOn(meta, "getMetaWhatsAppClient").mockReturnValue(provider as unknown as meta.MetaWhatsAppProviderClient);
    const intent = await WhatsAppConnectionService.createIntent(owner.id, org.id);
    let raced = false;
    interceptWrite("whatsAppConnectionIntent", async ({ data }) => {
      if (data.status !== "COMPLETED" || race === "current") return;
      raced = true;
      await testPrisma.whatsAppConnectionIntent.update({ where: { id: intent.intentId }, data: {
        ...(race === "reclaim" ? { leaseToken: "successor-onboarding-lease" } : {}),
        leaseUntil: new Date(NOW.getTime() + (race === "expire" ? -1 : 600_000)),
      } });
    });
    const operation = WhatsAppConnectionService.complete({
      actorUserId: owner.id, organizationId: org.id, intentId: intent.intentId, state: intent.state,
      code: "synthetic-code", businessId: ENV.META_BUSINESS_ID, wabaId: WABA.id, phoneNumberId: PHONE.id,
    });
    if (race === "current") {
      await expect(operation).resolves.toMatchObject({ senderId: sender.id, status: "ACTIVE" });
      await expect(testPrisma.whatsAppConnectionIntent.findUniqueOrThrow({ where: { id: intent.intentId } }))
        .resolves.toMatchObject({ status: "COMPLETED", leaseToken: null });
    } else {
      await expect(operation).rejects.toMatchObject({ code: "WHATSAPP_CONFLICT" });
      expect(raced).toBe(true);
      await expect(testPrisma.whatsAppSender.findUniqueOrThrow({ where: { id: sender.id } }))
        .resolves.toMatchObject({ lastSyncedAt: null, connectedByUserId: null });
      expect(await testPrisma.whatsAppAuditEvent.count({ where: { action: "CONNECTION_COMPLETED" } })).toBe(0);
      if (race === "reclaim") {
        await expect(testPrisma.whatsAppConnectionIntent.findUniqueOrThrow({ where: { id: intent.intentId } }))
          .resolves.toMatchObject({ status: "PROCESSING", leaseToken: "successor-onboarding-lease" });
      }
    }
  });
});

describe("WhatsApp rate-card maintenance fairness and identity", () => {
  it("covers 105 senders in successive bounded runs, preserves legacy scope, and reopens on a new expiry", async () => {
    const { org, branch, sender } = await world();
    await testPrisma.whatsAppSender.createMany({ data: Array.from({ length: 104 }, (_, i) => ({
      id: `audit-sender-${String(i).padStart(3, "0")}`, organizationId: org.id,
      provider: "META_CLOUD", providerMode: "TEST", wabaId: WABA.id,
      phoneNumberId: `audit-phone-${i}`, displayPhoneNumber: PHONE.displayPhoneNumber, status: "ACTIVE",
    })) });
    const legacy = await testPrisma.$transaction(tx => WhatsAppIncidentService.createOrTouchInTransaction({
      tx, organizationId: org.id, branchId: branch.id, senderId: sender.id, type: "RATE_CARD_EXPIRED",
      severity: "CRITICAL", safeCode: "RATE_CARD_EXPIRED", dedupeKey: `sender:${sender.id}:rate-card`,
      details: { rateCardVersion: "old-v0" }, now: NOW,
    }));
    for (let i = 0; i < 2; i++) await WhatsAppMaintenanceService.run({ invocationId: `audit-rate-${i}`, now: NOW, env: ENV });
    expect(await testPrisma.whatsAppOperationalIncident.count({ where: { type: "RATE_CARD_EXPIRED" } })).toBe(105);
    const idle = await WhatsAppMaintenanceService.run({ invocationId: "audit-rate-idle", now: NOW, env: ENV });
    expect(idle.counts).toMatchObject({ rateCardIncidents: 0 });
    await expect(testPrisma.whatsAppOperationalIncident.findUniqueOrThrow({ where: { id: legacy.id } }))
      .resolves.toMatchObject({ branchId: branch.id, details: { rateCardVersion: "audit-v1" }, occurrenceCount: 2 });
    const currentEnv = { ...ENV, WHATSAPP_RATE_CARD_EXPIRES_AT: "2027-01-01T00:00:00Z" };
    for (let i = 0; i < 2; i++) await WhatsAppMaintenanceService.run({ invocationId: `audit-current-${i}`, now: NOW, env: currentEnv });
    expect(await testPrisma.whatsAppOperationalIncident.count({ where: { status: { not: "RESOLVED" } } })).toBe(0);
    for (let i = 0; i < 2; i++) await WhatsAppMaintenanceService.run({ invocationId: `audit-new-expiry-${i}`, now: NOW, env: { ...ENV, WHATSAPP_RATE_CARD_VERSION: "audit-v2" } });
    expect(await testPrisma.whatsAppOperationalIncident.count({ where: { status: "OPEN", details: { path: ["rateCardVersion"], equals: "audit-v2" } } })).toBe(105);
    // A dispatcher-style observation uses exactly the same sender identity.
    await testPrisma.$transaction(tx => WhatsAppIncidentService.recordRateCardExpiredInTransaction({ tx, organizationId: org.id, senderId: sender.id, rateCardVersion: "audit-v2", now: NOW }));
  }, 30_000);

  it("rejects a foreign incident key without overwriting its evidence", async () => {
    const { org, sender, owner } = await world();
    const foreign = await createOrg({ ownerId: owner.id });
    const row = await testPrisma.whatsAppOperationalIncident.create({ data: {
      organizationId: foreign.id, type: "RATE_CARD_EXPIRED", severity: "CRITICAL",
      safeCode: "RATE_CARD_EXPIRED", dedupeKey: `sender:${sender.id}:rate-card`,
      firstSeenAt: NOW, lastSeenAt: NOW,
    } });
    await expect(testPrisma.$transaction(tx => WhatsAppIncidentService.recordRateCardExpiredInTransaction({ tx, organizationId: org.id, senderId: sender.id, rateCardVersion: "audit-v1", now: NOW })))
      .rejects.toMatchObject({ code: "WHATSAPP_INVALID_REQUEST" });
    await expect(testPrisma.whatsAppOperationalIncident.findUniqueOrThrow({ where: { id: row.id } }))
      .resolves.toMatchObject({ organizationId: foreign.id, occurrenceCount: 1, senderId: null });
  });
});

describe("WhatsApp correlation trust boundary", () => {
  it.each(["foreign-tenant", "other-sender", "wrong-mode", "recipient", "missing-recipient", "malformed", "missing", "unadmitted", "scheduled", "provider-collision", "global-provider-collision"])("leaves %s correlation unmatched", async mismatch => {
    const { org, branch, sender, owner } = await world();
    let messageSender = sender;
    let messageOrg = org;
    if (mismatch === "foreign-tenant") messageOrg = await createOrg({ ownerId: owner.id });
    if (["foreign-tenant", "other-sender", "wrong-mode"].includes(mismatch)) {
      messageSender = await testPrisma.whatsAppSender.create({ data: {
        organizationId: messageOrg.id, provider: "META_CLOUD", providerMode: mismatch === "wrong-mode" ? "LIVE" : "TEST",
        wabaId: WABA.id, phoneNumberId: mismatch === "wrong-mode" ? PHONE.id : "90009", displayPhoneNumber: PHONE.displayPhoneNumber,
      } });
    }
    const message = await testPrisma.whatsAppMessage.create({ data: {
      organizationId: messageOrg.id, branchId: mismatch === "foreign-tenant" ? null : branch.id,
      senderId: messageSender.id, recipientPhoneE164: "+919876543210", purpose: "MANUAL_REMINDER", trigger: "MANUAL",
      templateVariables: {}, scheduledFor: NOW, availableAt: NOW, dedupeKey: "audit-correlation",
      sourceFingerprint: "synthetic", status: mismatch === "scheduled" ? "SCHEDULED" : "UNKNOWN",
      budgetState: "COMMITTED", submissionStartedAt: NOW,
      providerCallAdmittedAt: mismatch === "unadmitted" ? null : NOW,
    } });
    if (mismatch.endsWith("provider-collision")) {
      const boundSender = mismatch === "global-provider-collision"
        ? await testPrisma.whatsAppSender.create({ data: {
          organizationId: org.id, provider: "META_CLOUD", providerMode: "TEST",
          wabaId: WABA.id, phoneNumberId: "80008", displayPhoneNumber: PHONE.displayPhoneNumber,
        } })
        : sender;
      await testPrisma.whatsAppMessage.create({ data: {
        organizationId: org.id, senderId: boundSender.id, recipientPhoneE164: "+919876543211",
        purpose: "MANUAL_REMINDER", trigger: "MANUAL", templateVariables: {}, scheduledFor: NOW,
        availableAt: NOW, dedupeKey: "audit-bound-provider-id", sourceFingerprint: "synthetic",
        providerMessageId: "wamid.audit.bound", status: "ACCEPTED",
      } });
    }
    const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA.id, changes: [{ field: "messages", value: {
      metadata: { phone_number_id: PHONE.id }, statuses: [{
        id: mismatch.endsWith("provider-collision") ? "wamid.audit.bound" : "wamid.audit.unmatched", status: "delivered",
        recipient_id: mismatch === "missing-recipient" ? undefined : mismatch === "recipient" ? "919876543299" : "919876543210",
        biz_opaque_callback_data: mismatch === "missing" ? undefined : mismatch === "malformed" ? { id: message.id } : message.id,
      }],
    } }] }] });
    await WhatsAppWebhookService.handle(new Request("https://audit.test/api/whatsapp/webhook", {
      method: "POST", body: raw, headers: { "x-hub-signature-256": `sha256=${createHmac("sha256", SECRET).update(raw).digest("hex")}` },
    }));
    await expect(testPrisma.whatsAppMessage.findUniqueOrThrow({ where: { id: message.id } }))
      .resolves.toMatchObject({ providerMessageId: null, status: message.status, budgetState: "COMMITTED" });
  });
});
