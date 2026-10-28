import type { Page } from "@playwright/test";

/** Refresh a real saved Clerk session before server-protected navigation.
 * This never fabricates authentication or changes application middleware.
 */
export async function refreshDevelopmentSession(page: Page) {
  // Authentication readiness is checked below; unrelated image/font loads must
  // not hold up refreshing the real saved development session.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      break;
    } catch (error) {
      // Chromium can invalidate its first navigation after a host adapter
      // change. Retry this read-only setup GET once; never replay assertions,
      // application writes, or other navigation failures.
      if (attempt > 0 || !(error instanceof Error) || !error.message.includes("net::ERR_NETWORK_CHANGED")) throw error;
    }
  }
  await page.waitForFunction(() => {
    const clerk = (window as unknown as { Clerk?: { loaded: boolean } }).Clerk;
    return clerk?.loaded;
  });
  // Business journeys explicitly reject optional analytics through the real
  // public consent control. This keeps a newly enabled synthetic GA tag from
  // leaving its consent panel over unrelated private-page controls.
  const rejectAnalytics = page.getByRole("button", { name: "Reject", exact: true });
  if (await rejectAnalytics.isVisible()) await rejectAnalytics.click();
  await page.evaluate(async () => {
    const clerk = (window as unknown as {
      Clerk: { session?: { getToken(options: { skipCache: boolean }): Promise<string | null> } };
    }).Clerk;
    if (!clerk.session || !await clerk.session.getToken({ skipCache: true })) {
      throw new Error("Saved Clerk session is unavailable; sign in to the development instance again.");
    }
  });
}
