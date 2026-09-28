import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { chromium } from "@playwright/test";

// Optional development-only real Clerk login for an EXISTING synthetic subject.
// No application auth bypass, user creation, email/OTP/SMS, billing or messaging.
const saved = process.env.PLAYWRIGHT_EXISTING_AUTH_STATE || ".clerk/rc-owner.json";
const output = process.env.PLAYWRIGHT_REFRESHED_AUTH_STATE || ".clerk/dashboard-owner-auth.json";
if (!output.replaceAll("\\", "/").startsWith(".clerk/")) throw new Error("Authentication output must remain in ignored .clerk");
const env = parse(readFileSync(".env"));
const key = process.env.CLERK_SECRET_KEY || env.CLERK_SECRET_KEY;
const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!key?.startsWith("sk_test_") || !publishable?.startsWith("pk_test_")) throw new Error("Only Clerk development credentials are allowed");
const state = JSON.parse(readFileSync(saved, "utf8"));
const oldToken = state.cookies.find(cookie => cookie.name === "__session")?.value;
if (!oldToken) throw new Error("An existing saved synthetic development session is required");
const subject = JSON.parse(Buffer.from(oldToken.split(".")[1], "base64url").toString()).sub;
if (typeof subject !== "string" || !subject.startsWith("user_")) throw new Error("Invalid existing development subject");
const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const lookup = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(subject)}`, { headers });
if (!lookup.ok) throw new Error(`Development user lookup failed (${lookup.status}); no auth state changed`);
const user = await lookup.json();
const emails = user.email_addresses?.map(item => item.email_address) || [];
if (!emails.length || !emails.every(email => /\+clerk_test@|@(?:example\.(?:com|invalid)|clerk\.test)$/.test(email))) {
    throw new Error("Existing saved subject is not a verified synthetic test identity; no token created");
}
const url = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117";
if (new URL(url).hostname !== "localhost") throw new Error("Only localhost preview is allowed");
const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => window.Clerk?.loaded, {}, { timeout: 45_000 });
    const response = await fetch("https://api.clerk.com/v1/sign_in_tokens", { method: "POST", headers,
        body: JSON.stringify({ user_id: subject, expires_in_seconds: 120 }) });
    if (!response.ok) throw new Error(`Development sign-in ticket failed (${response.status})`);
    const ticket = await response.json();
    const complete = await page.evaluate(async ticket => {
        const attempt = await window.Clerk.client.signIn.create({ strategy: "ticket", ticket });
        if (attempt.status !== "complete") return false;
        await window.Clerk.setActive({ session: attempt.createdSessionId });
        return Boolean(await window.Clerk.session.getToken({ skipCache: true }));
    }, ticket.token);
    if (!complete) throw new Error("Development sign-in did not complete");
    await page.context().storageState({ path: output });
    console.log("Real Clerk development session refreshed for verified existing synthetic test identity; state saved under ignored .clerk. No account, email, OTP, SMS, payment or messaging action.");
} finally { await browser.close(); }
