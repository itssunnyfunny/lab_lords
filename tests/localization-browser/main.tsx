import { useState } from "react";
import { createRoot } from "react-dom/client";
import { UserPreferencesProvider } from "@/components/settings/UserPreferencesApplier";
import { LanguageControls } from "@/components/settings/LanguageControls";
import { CollectFeeDialog } from "@/components/payments/CollectFeeDialog";
import { AttendanceContent } from "@/components/attendance/AttendanceContent";
import { RenewalsContent } from "@/components/renewals/RenewalsContent";
import { AddStudentDialog } from "@/app/branch/[branchId]/students/AddStudentDialog";
import type { BranchAccess } from "@/types";
import "@/app/globals.css";

// Isolated component exercise. There is no Clerk bypass or database connection.
const access = { branchId: "localization", branchName: "Sample Library", organizationId: "org", isOwner: true,
    role: "OWNER", effectivePlan: "BASIC", entitlements: [],
    permissions: { students: true, manage_branch: true, view_payments: true, mark_payment_paid: true, seat_allocation: true },
} as unknown as BranchAccess;
function Fixture() {
    const [user, setUser] = useState(() => sessionStorage.getItem("fixture-user") ?? "one");
    const [view, setView] = useState("renewals");
    return <div className="dark min-h-screen bg-slate-950 p-4 text-slate-100">
        <div className="flex flex-wrap gap-4 p-3">
            <button onClick={() => { sessionStorage.setItem("fixture-user", user === "one" ? "two" : "one"); setUser(user === "one" ? "two" : "one"); }}>Switch fixture user</button>
            <button onClick={() => setView("collection")}>Collection fixture</button>
            <button onClick={() => setView("attendance")}>Attendance fixture</button>
            <button onClick={() => setView("renewals")}>Renewal fixture</button>
            <button onClick={() => setView("admission")}>Admission fixture</button>
        </div>
        <UserPreferencesProvider key={user} ownerKey={user}>
            <LanguageControls />
            {view === "collection" ? <CollectFeeDialog branchId="localization" studentId="student" onClose={() => setView("renewals")} onSaved={() => {}} />
                : view === "admission" ? <AddStudentDialog isOpen branchId="localization" allocationDecision={{ allowed: true, blocker: null, reason: null, recoveryHref: null }} onClose={() => setView("renewals")} onSuccess={() => setView("renewals")} />
                : view === "attendance" ? <AttendanceContent branchId="localization" access={access} />
                : <RenewalsContent branchId="localization" access={access} />}
        </UserPreferencesProvider>
    </div>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
