import { prisma } from "../lib/prisma";
import { runBranchAI } from "../ai/orchestrator/branchAI.orchestrator";

async function main() {
    console.log("Starting Verification...");

    const branch = await prisma.branch.findFirst({
        include: { students: true },
    });

    if (!branch) {
        console.error("No branch found");
        return;
    }

    console.log(`Testing with Branch: ${branch.name} (${branch.id})`);

    console.log("\n1. Running Initial AI Call...");
    const result1 = await runBranchAI(branch.id);
    console.log(`Result 1 Generated At: ${result1.meta.generatedAt}`);

    console.log("\n2. Running Second AI Call (Should be cached)...");
    const result2 = await runBranchAI(branch.id);
    console.log(`Result 2 Generated At: ${result2.meta.generatedAt}`);

    if (result1.meta.generatedAt === result2.meta.generatedAt) {
        console.log("SUCCESS: Result was cached.");
    } else {
        console.error("FAILURE: Result was NOT cached.");
    }

    console.log("\n3. Simulating Data Change...");
    await new Promise(resolve => setTimeout(resolve, 1100));
    await prisma.branch.update({
        where: { id: branch.id },
        data: { lastDataChange: new Date() },
    });

    console.log("4. Running Third AI Call (Should be fresh)...");
    const result3 = await runBranchAI(branch.id);
    console.log(`Result 3 Generated At: ${result3.meta.generatedAt}`);

    if (result3.meta.generatedAt !== result1.meta.generatedAt) {
        console.log("SUCCESS: Result was fresh.");
    } else {
        console.error("FAILURE: Result was cached despite data change.");
    }

    if (result3.report.generatedAt && Array.isArray(result3.report.suggestedActions)) {
        console.log(`\nFound ${result3.report.suggestedActions.length} suggested action(s).`);
        console.log("SUCCESS: Structured report returned expected fields.");
    } else {
        console.error("FAILURE: Structured report missing expected fields.");
    }
}

main()
    .catch((error) => console.error(error))
    .finally(async () => {
        await prisma.$disconnect();
    });
