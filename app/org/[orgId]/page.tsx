"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrgDashboardPage() {
    const router = useRouter();

    // For Phase 0/1, we auto-redirect to the first branch of the org
    // effectively skipping the "Org Dashboard" which is a Phase F requirement.
    useEffect(() => {
        router.replace("/branch/1");
    }, [router]);

    return (
        <div className="flex items-center justify-center h-full">
            <p className="text-textSecondary animate-pulse">Redirecting to branch...</p>
        </div>
    );
}
