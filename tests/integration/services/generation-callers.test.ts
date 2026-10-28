import { AccessPolicy } from "@/services/accessPolicy.service";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestWorld, createSaasSubscription } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";
import { runBranchAI } from "@/ai/orchestrator/branchAI.orchestrator";
const mocks = vi.hoisted(() => ({ report: vi.fn(), gemini: vi.fn() }));
vi.mock("@/ai/branchHealthReport", () => ({ generateBranchHealthReport: mocks.report }));
vi.mock("@/ai/llm/gemini.client", () => ({ callGemini: mocks.gemini }));

describe("AI generation callers", () => {
  beforeEach(async () => { vi.restoreAllMocks(); vi.clearAllMocks(); await resetDatabase(); });
  afterAll(disconnectDatabase);

  it("takes over an expired report owner at six minutes and rejects its late completion", async () => {
    const { branch, user, org } = await createTestWorld();
    await createSaasSubscription({organizationId:org.id});
    const access = await AccessPolicy.authorizeCapability(user.id,branch.id,"aiGenerate");
    await testPrisma.branch.update({ where: { id: branch.id }, data: { aiEnabled: true } });
    let resolveOld!: (report: object) => void;
    let admitted!: () => void;
    const started = new Promise<void>(resolve => { admitted = resolve; });
    mocks.report.mockImplementationOnce(() => {
      admitted();
      return new Promise(resolve => { resolveOld = resolve; });
    }).mockResolvedValue({ marker: "current" });
    const oldRun = runBranchAI(access);
    const oldOutcome = expect(oldRun).rejects.toThrow("ownership");
    await started;
    await testPrisma.branch.update({ where: { id: branch.id }, data: { aiLastCalledAt: new Date(Date.now() - 6 * 60_000) } });
    await testPrisma.branchGenerationLease.updateMany({ where: { branchId: branch.id }, data: { leaseUntil: new Date(0) } });
    await expect(runBranchAI(access)).resolves.toMatchObject({ report: { marker: "current" } });
    resolveOld({ marker: "stale" });
    await oldOutcome;
    expect(await testPrisma.branchAIReport.count({ where: { branchId: branch.id } })).toBe(1);
    expect(await testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } })).toMatchObject({ aiStatus: "IDLE" });
  });

});
