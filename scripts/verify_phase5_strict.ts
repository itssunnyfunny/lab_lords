
import { detectBranchRisks, calculateHealthScore } from "../ai/riskDetection/branchRiskDetector";
import { suggestActionsForBranch } from "../ai/actionSuggestions/branchActionSuggester";
import { draftMessagesForBranch } from "../ai/messageDrafting/branchMessageDrafter";
import { generateBranchHealthReport } from "../ai/branchHealthReport";
import { AIBranchSnapshot } from "../ai/contracts/branch.contract";

// Mock Snapshots
const zeroDataSnapshot: AIBranchSnapshot = {
    branchId: "test-branch",
    branchName: "Test Branch",
    seats: { total: 0, occupied: 0, available: 0, utilizationPercent: 0 },
    students: { total: 0, active: 0, inactive: 0 },
    payments: { dueCount: 0, paidCount: 0, overdueCount: 0, overduePayments: [] },
    asOf: new Date()
};

const riskySnapshot: AIBranchSnapshot = {
    branchId: "test-branch",
    branchName: "Test Branch",
    seats: { total: 100, occupied: 10, available: 90, utilizationPercent: 10 },
    students: { total: 20, active: 5, inactive: 15 }, // High inactive
    payments: { dueCount: 5, paidCount: 0, overdueCount: 5, overduePayments: [] }, // 100% overdue
    asOf: new Date()
};

async function runVerification() {
    console.log("🔒 PHASE 5 STRICT VERIFICATION\n");

    // 1. Verify Zero Data Handling
    console.log("TEST 1: Zero Data Handling");
    const zeroRisks = detectBranchRisks(zeroDataSnapshot);
    const zeroScore = calculateHealthScore(zeroDataSnapshot, zeroRisks);
    const zeroActions = suggestActionsForBranch(zeroRisks);

    if (zeroRisks.some(r => r.type === "NO_DATA") && zeroScore === "LOW_RISK" && zeroActions.some(a => a.action === "ADD_FIRST_STUDENT")) {
        console.log("✅ Zero Data: Handled correctly (NO_DATA risk, ADD_FIRST_STUDENT action)");
    } else {
        console.error("❌ Zero Data: FAILED", { zeroRisks, zeroScore, zeroActions });
    }

    // 2. Verify Deterministic Risk Logic
    console.log("\nTEST 2: Strict Risk Rules (Risky Snapshot)");
    const strictRisks = detectBranchRisks(riskySnapshot);
    const strictScore = calculateHealthScore(riskySnapshot, strictRisks);

    const hasOverdue = strictRisks.some(r => r.type === "PAYMENT_OVERDUE" && r.severity === "HIGH");
    const hasInactive = strictRisks.some(r => r.type === "HIGH_INACTIVE_STUDENTS" && r.severity === "HIGH");
    const hasUtilization = strictRisks.some(r => r.type === "LOW_SEAT_UTILIZATION" && r.severity === "MEDIUM");

    if (hasOverdue && hasInactive && hasUtilization && strictScore === "CRITICAL_RISK") {
        console.log("✅ Risk Logic: All strict rules triggered correctly.");
    } else {
        console.error("❌ Risk Logic: FAILED", { strictRisks, strictScore });
    }

    // 3. Verify Message Drafting (No Sending)
    console.log("\nTEST 3: Message Drafting");
    const messagesEn = await draftMessagesForBranch(riskySnapshot.branchId, suggestActionsForBranch(strictRisks), "en");
    const messagesHi = await draftMessagesForBranch(riskySnapshot.branchId, suggestActionsForBranch(strictRisks), "hi");

    if (messagesEn.length > 0 && messagesHi.length > 0 && messagesEn[0].message !== messagesHi[0].message) {
        console.log("✅ Messages: Drafts generated in English and Hindi.");
    } else {
        console.error("❌ Messages: FAILED");
    }

    console.log("\n✨ VERIFICATION COMPLETE");
}

runVerification();
