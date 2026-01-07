"use client";

import { useEffect, use, useState } from "react";
import { useRouter } from "next/navigation";
import { organizations } from "@/lib/api/organizations";
import { Branch } from "@prisma/client";
import { Loader2 } from "lucide-react";

export default function OrgDashboardPage({ params }: { params: Promise<{ orgId: string }> }) {
    const router = useRouter();
    const { orgId } = use(params);
    const [error, setError] = useState<string | null>(null);

    // For Phase 0/1, we auto-redirect to the first branch of the org
    useEffect(() => {
        const redirect = async () => {
            try {
                const branches = await organizations.getBranches(orgId);
                if (branches && branches.length > 0) {
                    router.replace(`/branch/${branches[0].id}`);
                } else {
                    setError("No branches found in this organization.");
                }
            } catch (err) {
                console.error("Failed to fetch branches for redirect", err);
                setError("Failed to load workspace.");
            }
        };
        redirect();
    }, [orgId, router]);

    return (
        <div className="flex flex-col items-center justify-center h-full text-white min-h-[50vh]">
            {error ? (
                <div className="text-red-400 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    {error}
                </div>
            ) : (
                <>
                    <Loader2 className="animate-spin text-cyan-500 mb-4 w-8 h-8" />
                    <p className="text-gray-400 animate-pulse">Redirecting to workspace...</p>
                </>
            )}
        </div>
    );
}
