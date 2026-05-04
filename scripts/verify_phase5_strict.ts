import { detectBranchRisks, calculateHealthScore } from "../ai/riskDetection/branchRiskDetector";
import { suggestActionsForBranch } from "../ai/actionSuggestions/branchActionSuggester";
import { draftOverdueMessages } from "../ai/messageDrafting/branchMessageDrafter";
import { AIBranchSnapshot } from "../ai/contracts/branch.contract";

const zeroDataSnapshot: AIBranchSnapshot = {
    branchId: "test-branch",
    branchName: "Test Branch",
    seats: { total: 0, occupied: 0, available: 0, utilizationPercent: 0, shiftBreakdown: [] },
    students: { total: 0, active: 0, inactive: 0 },
    payments: { dueCount: 0, paidCount: 0, overdueCount: 0, overduePayments: [] },
    asOf: new Date(),
};

const riskySnapshot: AIBranchSnapshot = {
    branchId: "test-branch",
    branchName: "Test Branch",
    seats: { total: 100, occupied: 10, available: 90, utilizationPercent: 10, shiftBreakdown: [] },
    students: { total: 20, active: 5, inactive: 15 },
    payments: { dueCount: 5, paidCount: 0, overdueCount: 5, overduePayments: [] },
    asOf: new Date(),
};

async function runVerification() {
    console.log("PHASE 5 STRICT VERIFICATION\n");

    console.log("TEST 1: Zero Data Handling");
    const zeroRisks = detectBranchRisks(zeroDataSnapshot);
    const zeroScore = calculateHealthScore(zeroDataSnapshot, zeroRisks);
    const zeroActions = suggestActionsForBranch(zeroRisks);

    if (
        zeroRisks.some(r => r.type === "NO_DATA") &&
        zeroScore === "LOW_RISK" &&
        zeroActions.some(a => a.action === "ADD_FIRST_STUDENT")
    ) {
        console.log("PASS: Zero data handled correctly.");
    } else {
        console.error("FAIL: Zero data", { zeroRisks, zeroScore, zeroActions });
    }

    console.log("\nTEST 2: Strict Risk Rules");
    const strictRisks = detectBranchRisks(riskySnapshot);
    const strictScore = calculateHealthScore(riskySnapshot, strictRisks);

    const hasOverdue = strictRisks.some(r => r.type === "PAYMENT_OVERDUE" && r.severity === "HIGH");
    const hasInactive = strictRisks.some(r => r.type === "HIGH_INACTIVE_STUDENTS" && r.severity === "HIGH");
    const hasUtilization = strictRisks.some(r => r.type === "LOW_SEAT_UTILIZATION" && r.severity === "MEDIUM");

    if (hasOverdue && hasInactive && hasUtilization && strictScore === "CRITICAL_RISK") {
        console.log("PASS: Strict risk rules triggered correctly.");
    } else {
        console.error("FAIL: Strict risk rules", { strictRisks, strictScore });
    }

    console.log("\nTEST 3: Message Drafting");
    const messagesEn = await draftOverdueMessages(riskySnapshot.branchId, "en");
    const messagesHi = await draftOverdueMessages(riskySnapshot.branchId, "hi");

    if (messagesEn.length > 0 && messagesHi.length > 0 && messagesEn[0].message !== messagesHi[0].message) {
        console.log("PASS: Drafts generated in English and Hindi.");
    } else {
        console.error("FAIL: Message drafting");
    }

    console.log("\nVERIFICATION COMPLETE");
}

runVerification();
