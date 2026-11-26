import type { HistoricalBillingTestProcess } from "@/lib/billingHistoricalFixtures";

const testProcess = globalThis as HistoricalBillingTestProcess;

export function registerHistoricalBillingFixture(organizationId: string) {
  if (process.env.NODE_ENV !== "test") throw new Error("Historical billing fixtures require the test environment");
  (testProcess.historicalBillingFixtures ??= new Set()).add(organizationId);
}

export function clearHistoricalBillingFixtures() {
  testProcess.historicalBillingFixtures?.clear();
}
