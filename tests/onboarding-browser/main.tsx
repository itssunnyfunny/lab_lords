import { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import OnboardingPage from "@/app/onboarding/page";
import { UserPreferencesProvider } from "@/components/settings/UserPreferencesApplier";
import { switchFixtureAccount, useUser } from "./clerk";
import { BasicWorkspace } from "@/components/basic/BasicWorkspace";
import ImportPage from "@/app/branch/[branchId]/onboarding/import/page";
import { basicImportAccess } from "./basic-access";
import "@/app/globals.css";

// Component-only exercise: fake identity and synthetic HTTP responses. This
// fixture is never mounted in the application or an authentication boundary.
const searchParams = Promise.resolve({});
const importParams = Promise.resolve({ branchId: "fixture-branch" });
function Fixture() {
    const { user } = useUser();
    const [destination, setDestination] = useState("");
    useEffect(() => {
        const navigated = (event: Event) => setDestination((event as CustomEvent<string>).detail);
        window.addEventListener("onboarding-fixture-navigation", navigated);
        return () => window.removeEventListener("onboarding-fixture-navigation", navigated);
    }, []);
    return <>
        <div data-fixture-controls className="flex items-center gap-4 bg-white p-2 text-sm text-black"><button onClick={switchFixtureAccount}>Switch fixture account</button><output data-testid="destination">{destination}</output></div>
        <UserPreferencesProvider key={user.id} ownerKey={user.id}><Suspense fallback={<p>Loading fixture</p>}>{window.location.pathname.startsWith("/branch/fixture-branch")
            ? <BasicWorkspace access={basicImportAccess(new URLSearchParams(window.location.search).get("scenario") ?? "paid")} importContent={<ImportPage params={importParams} />} />
            : <OnboardingPage searchParams={searchParams} />}</Suspense></UserPreferencesProvider>
    </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
