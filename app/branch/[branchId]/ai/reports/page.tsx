"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Loader2 } from "lucide-react";
import { BranchHealthPanel } from "@/components/ai/BranchHealthPanel";

// Define the interface locally or import it if shared
import { AIStructuredBranchReport } from "@/ai/contracts/structuredReport.contract";

interface AIResponse {
    report: AIStructuredBranchReport;
    meta: { generatedAt: string };
    hasPendingChanges?: boolean;
    nextAllowedCallAt?: string;
}

export default function AIReportsPage() {
    const params = useParams();
    const branchId = params.branchId as string;

    const [data, setData] = useState<AIResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/ai/branch/${branchId}`);
            if (!res.ok) throw new Error("Failed to fetch report");
            const json = await res.json();
            console.log("AI Report Data:", json);
            setData(json);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [branchId]);

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="p-8 h-full flex flex-col space-y-8">
            <PageHeader
                title="AI Branch Health"
                subtitle="Automated operational analysis and risk detection."
            />

            <div className="max-w-5xl mx-auto w-full">
                <BranchHealthPanel
                    report={data?.report || null}
                    hasPendingChanges={data?.hasPendingChanges}
                    nextAllowedCallAt={data?.nextAllowedCallAt}
                    onRefresh={fetchData}
                />
            </div>
        </div>
    );
}
