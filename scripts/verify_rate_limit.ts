
import { prisma } from "../lib/prisma";
import { runBranchAI } from "../ai/orchestrator/branchAI.orchestrator";

async function main() {
    console.log("Starting Verification...");

    const branch = await prisma.branch.findFirst({
        include: { students: true }
    });

    if (!branch) {
        console.error("No branch found");
        return;
    }

    console.log(`Testing with Branch: ${branch.name} (${branch.id})`);

    // 1. Initial Call
    console.log("\n1. Running Initial AI Call...");
    const result1 = await runBranchAI(branch.id);
    console.log(`Result 1 Generated At: ${result1.meta.generatedAt}`);

    // 2. Cached Call
    console.log("\n2. Running Second AI Call (Should be cached)...");
    const result2 = await runBranchAI(branch.id);
    console.log(`Result 2 Generated At: ${result2.meta.generatedAt}`);

    if (result1.meta.generatedAt === result2.meta.generatedAt) {
        console.log("✅ SUCCESS: Result was cached.");
    } else {
        console.error("❌ FAILURE: Result was NOT cached.");
    }

    // 3. Data Mutation (Simulated)
    console.log("\n3. Simulating Data Change...");
    await new Promise(resolve => setTimeout(resolve, 1100)); // Wait > 1s to ensure distinct timestamp
    await prisma.branch.update({
        where: { id: branch.id },
        data: { lastDataChange: new Date() }
    });

    // 4. Fresh Call
    console.log("4. Running Third AI Call (Should be fresh)...");
    const result3 = await runBranchAI(branch.id);
    console.log(`Result 3 Generated At: ${result3.meta.generatedAt}`);

    if (result3.meta.generatedAt !== result1.meta.generatedAt) {
        console.log("✅ SUCCESS: Result was fresh.");
    } else {
        console.error("❌ FAILURE: Result was cached despite data change.");
    }

    // 5. Message Draft Check
    // We can't easily force an overdue student here without polluting DB, 
    // but we can check if messages were returned and if they exist in DB.
    if (result3.messages.items.length > 0) {
        console.log(`\nFound ${result3.messages.items.length} messages.`);
        // Verify existence in DB
        // We need to query MessageDraft.
        const drafts = await prisma.messageDraft.findMany({
            where: { branchId: branch.id }
        });
        console.log(`Found ${drafts.length} drafts in DB.`);
        if (drafts.length >= result3.messages.items.length) {
            console.log("✅ SUCCESS: Drafts persisted in DB.");
        } else {
            console.log("⚠️ WARNING: Draft count mismatch (might include language variants or old drafts).");
        }
    } else {
        console.log("\nNo messages generated (no risks found?), skipping draft verification.");
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
