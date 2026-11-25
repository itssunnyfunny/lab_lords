import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function readTestCredentials() {
    // Read only the allowlisted Razorpay credential assignments. Never load an env
    // file into process.env, print its contents, or inherit another provider's keys.
    const credentialNames = new Set(["RAZORPAY_MODE", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_TEST_KEY_ID", "RAZORPAY_TEST_KEY_SECRET"]);
    const credentials = {};
    const credentialRoot = resolve(process.env.BILLING_TEST_CREDENTIAL_DIR || process.cwd());
    for (const name of [".env", ".env.local"]) {
        const path = resolve(credentialRoot, name);
        if (!existsSync(path)) continue;
        for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
            const match = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/);
            if (!match || !credentialNames.has(match[1])) continue;
            let value = match[2];
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
            else value = value.replace(/\s+#.*$/, "").trim();
            credentials[match[1]] = value;
        }
    }
    const explicitTestPair = credentials.RAZORPAY_TEST_KEY_ID && credentials.RAZORPAY_TEST_KEY_SECRET;
    const keyId = explicitTestPair ? credentials.RAZORPAY_TEST_KEY_ID : credentials.RAZORPAY_KEY_ID;
    const keySecret = explicitTestPair ? credentials.RAZORPAY_TEST_KEY_SECRET : credentials.RAZORPAY_KEY_SECRET;
    if (!keyId?.startsWith("rzp_test_") || !keySecret || (!explicitTestPair && credentials.RAZORPAY_MODE?.toUpperCase() !== "TEST")) {
        throw new Error("A complete, explicitly Test-mode Razorpay credential pair is required; Live keys are refused.");
    }
    return { keyId, keySecret };
}
