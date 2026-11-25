import { readFileSync } from "node:fs";
import { assertDirectConversionDatabase } from "./branch-conversion-target";

const [command, organizationId, planFile, digest] = process.argv.slice(2);
try {
    assertDirectConversionDatabase(process.env.DATABASE_URL, process.env.ACCELERATE_URL);
    if (!organizationId || !planFile || !["preflight", "apply"].includes(command)
        || (command === "apply" && !/^[0-9a-f]{64}$/.test(digest ?? ""))) {
        throw new Error("Usage: tsx scripts/convert-branch-billing.ts preflight|apply ORG_ID PLANS_JSON [reviewed digest]");
    }
    const choices = JSON.parse(readFileSync(planFile, "utf8"));
    if (!choices || Array.isArray(choices) || typeof choices !== "object") throw new Error("Expected a branch ID to catalogue plan mapping");
    const { BranchBillingConversion } = await import("../services/branchBillingConversion.service");
    const { prisma } = await import("../lib/prisma");
    try {
        const result = command === "preflight"
            ? await BranchBillingConversion.preflight(organizationId, choices)
            : await BranchBillingConversion.apply(organizationId, choices, digest);
        console.log(JSON.stringify(result, null, 2));
    } finally { await prisma.$disconnect(); }
} catch {
    console.error("Conversion held. Verify configuration and inspect the read-only preflight.");
    process.exitCode = 1;
}
