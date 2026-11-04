import { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import ImportPage from "@/app/branch/[branchId]/onboarding/import/page";
import { ImportSessionWizard } from "@/app/branch/[branchId]/onboarding/import/[sessionId]/_components/ImportSessionWizard";
import { UserPreferencesProvider } from "@/components/settings/UserPreferencesApplier";
import { BranchAccessProvider } from "@/components/layout/BranchAccessProvider";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import type { BranchAccess } from "@/types";
import "@/app/globals.css";

// Dedicated test origin. Identity exists only in the server's disposable fixture;
// production authentication and application routing have no bypass or test flag.
function Fixture({ access }: { access: BranchAccess }) {
    const [destination, setDestination] = useState(location.pathname);
    const [params] = useState(() => Promise.resolve({ branchId: access.branchId }));
    useEffect(() => { const navigate = (e: Event) => { const href = (e as CustomEvent<string>).detail; history.pushState({}, "", href); setDestination(href); };
        window.addEventListener("onboarding-fixture-navigation", navigate);
        return () => window.removeEventListener("onboarding-fixture-navigation", navigate);
    }, []);
    const sessionId = destination.match(/\/import\/([^?]+)/)?.[1];
    return <UserPreferencesProvider ownerKey="synthetic-import-owner"><BranchAccessProvider branchId={access.branchId}><Suspense fallback={<p>Loading</p>}>
        {sessionId ? <ImportSessionWizard branchId={access.branchId} sessionId={sessionId} importDecision={getBranchCapabilityDecision(access, "importStudents")} /> : <ImportPage params={params} />}
    </Suspense></BranchAccessProvider></UserPreferencesProvider>;
}
fetch("/api/fixture/access").then(response => response.json()).then(access => createRoot(document.getElementById("root")!).render(<Fixture access={access} />));
