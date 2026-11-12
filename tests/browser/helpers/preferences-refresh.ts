import type { Page } from "@playwright/test";

/** Synthetic-fixture save/notification, as if Preferences were saved elsewhere.
 * The Account browser cases separately exercise the actual preference controls. */
export async function refreshInterfaceLanguage(page: Page, language: "en" | "hi" | "hinglish", ownerKey?: string) {
    await page.evaluate(async ({ interfaceLanguage, ownerKey }) => {
        const response = await fetch("/api/users/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interfaceLanguage }) });
        if (!response.ok) throw new Error("Synthetic preference save failed");
        window.dispatchEvent(new CustomEvent("lablords:preferences-updated", { detail: {
            interfaceLanguage, ownerKey: ownerKey ?? new URL(location.href).searchParams.get("identity") ?? "pilot-owner",
        } }));
    }, { interfaceLanguage: language, ownerKey });
}
