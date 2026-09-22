import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { usePathname, useSearchParams } from "next/navigation";
import { BranchWorkspaceShell } from "@/components/layout/BranchWorkspaceShell";
import { UserPreferencesProvider } from "@/components/settings/UserPreferencesApplier";
import { PageLoadingSkeleton, PageShell } from "@/components/ui";
import { CollectFeeDialog } from "@/components/payments/CollectFeeDialog";
import BranchDashboardPage from "@/app/branch/[branchId]/page";
import StudentsPage from "@/app/branch/[branchId]/students/page";
import SeatsPage from "@/app/branch/[branchId]/seats/page";
import "@/app/globals.css";

const BRANCH_ID = "pilot";
const BRANCH_PARAMS = Promise.resolve({ branchId: BRANCH_ID });

function CollectionScenario({ usePilotTheme }: { usePilotTheme: boolean }) {
    return (
        <PageShell>
            <div className="rounded-[var(--ui-radius-panel)] border border-[color:var(--ui-panel-border)] bg-[color:var(--ui-panel-bg)] p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">Synthetic financial workflow</p>
                <h1 className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">Collection recovery scenario</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
                    This uses the production collection dialog against an in-memory adapter. No payment provider, customer record, or database is contacted.
                </p>
            </div>
            <CollectFeeDialog
                branchId={BRANCH_ID}
                studentId="student-aarav"
                onClose={() => window.history.back()}
                onSaved={() => undefined}
                usePilotTheme={usePilotTheme}
            />
        </PageShell>
    );
}

function PilotSurface() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const collection = searchParams.get("surface") === "collection";

    if (collection) return <CollectionScenario usePilotTheme={searchParams.get("mode") !== "baseline"} />;
    if (pathname.endsWith("/students")) return <StudentsPage params={BRANCH_PARAMS} />;
    if (pathname.endsWith("/seats")) return <SeatsPage params={BRANCH_PARAMS} />;
    return <BranchDashboardPage params={BRANCH_PARAMS} />;
}

function FixtureLabel() {
    return (
        <>
            <style>{`
                body:has([data-dialog-overlay="true"]) [data-testid="synthetic-pilot-label"] {
                    position: fixed;
                    inset: 0 0 auto;
                    z-index: 200;
                    width: 100%;
                    max-width: none;
                    border-radius: 0;
                    padding: 1px 4px;
                    font-size: 7px;
                    line-height: 10px;
                    text-align: center;
                }

                body:has([data-dialog-overlay="true"] > [role="dialog"].h-full)
                    [data-dialog-overlay="true"] > [role="dialog"].h-full {
                    padding-top: max(1.75rem, env(safe-area-inset-top));
                }
            `}</style>
            <div
                data-testid="synthetic-pilot-label"
                className="pointer-events-none relative z-[90] w-full border-b border-amber-300/30 bg-slate-950/95 px-2 py-1 text-center text-[8px] font-semibold uppercase leading-3 tracking-wider text-amber-100"
            >
                Synthetic design pilot · no Clerk, database, or providers
            </div>
        </>
    );
}

function ApplicationDesignPilot() {
    return (
        <UserPreferencesProvider ownerKey="application-design-pilot">
            <FixtureLabel />
            <BranchWorkspaceShell branchId={BRANCH_ID}>
                <Suspense fallback={<PageLoadingSkeleton label="Loading pilot surface" variant="workspace" />}>
                    <PilotSurface />
                </Suspense>
            </BranchWorkspaceShell>
        </UserPreferencesProvider>
    );
}

createRoot(document.getElementById("root")!).render(<ApplicationDesignPilot />);
