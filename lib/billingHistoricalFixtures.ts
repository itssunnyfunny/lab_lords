export type HistoricalBillingTestProcess = typeof globalThis & {
  historicalBillingFixtures?: Set<string>;
};

export function isHistoricalBillingFixture(organizationId: string) {
  return process.env.NODE_ENV === "test"
    && (globalThis as HistoricalBillingTestProcess).historicalBillingFixtures?.has(organizationId) === true;
}
