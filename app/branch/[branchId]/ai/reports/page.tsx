"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Loader2, FileText } from "lucide-react";

interface AIResponse {
    report: { full: string };
    meta: { generatedAt: string };
}

export default function AIReportsPage() {
    const params = useParams();
    const branchId = params.branchId as string;

    const [data, setData] = useState<AIResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch(`/api/ai/branch/${branchId}`);
                if (!res.ok) throw new Error("Failed to fetch report");
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [branchId]);

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="p-8 h-full flex flex-col">
            <PageHeader
                title="AI Reports"
                subtitle="Comprehensive analysis of your branch performance."
            />

            <div className="grid grid-cols-1 gap-6 mt-8">
                <Card className="p-8 max-w-4xl mx-auto w-full bg-card">
                    <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Full Branch Report</h2>
                            <p className="text-sm text-textMuted">
                                Generated on {new Date(data.meta.generatedAt).toLocaleDateString()} at {new Date(data.meta.generatedAt).toLocaleTimeString()}
                            </p>
                        </div>
                    </div>

                    <div className="prose prose-invert prose-sm max-w-none text-textSecondary whitespace-pre-wrap font-sans leading-relaxed">
                        {data.report.full}
                    </div>
                </Card>
            </div>
        </div>
    );
}
