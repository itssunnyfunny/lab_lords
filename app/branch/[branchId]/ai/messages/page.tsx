"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, MessageSquare, Copy, Check } from "lucide-react";

interface AIResponse {
    messages: {
        items: Array<{ action: string; message: string }>;
    };
}

export default function AIMessagesPage() {
    const params = useParams();
    const branchId = params.branchId as string;

    const [data, setData] = useState<AIResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch(`/api/ai/branch/${branchId}`);
                if (!res.ok) throw new Error("Failed to fetch messages");
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

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    if (!data || data.messages.items.length === 0) {
        return (
            <div className="p-8">
                <PageHeader title="Message Drafts" subtitle="AI-generated drafts for student communication." />
                <div className="p-12 text-center text-textMuted border border-dashed border-border rounded-lg mt-8">
                    <MessageSquare className="mx-auto mb-4 opacity-50" size={48} />
                    <p>No messages to draft right now.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8">
            <PageHeader
                title="Message Drafts"
                subtitle="Review and copy AI-drafted messages for your students."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {data.messages.items.map((item, i) => (
                    <Card key={i} className="p-6 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-xs font-mono uppercase bg-primary/10 text-primary px-2 py-1 rounded">
                                    {item.action.replace(/_/g, " ")}
                                </span>
                            </div>
                            <div className="bg-background/50 p-4 rounded-lg text-textSecondary text-sm italic border border-border/50 mb-6">
                                "{item.message}"
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopy(item.message, i)}
                                className="flex items-center gap-2"
                            >
                                {copiedIndex === i ? (
                                    <>
                                        <Check size={14} className="text-green-500" />
                                        <span className="text-green-500">Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={14} />
                                        <span>Copy Text</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
