"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { MessageDraft } from "@/components/ai/MessageDraft";
import { Button } from "@/components/ui/Button";
import { Loader2, MessageSquare, Languages } from "lucide-react";

interface AIResponse {
    messages: {
        language: "en" | "hi";
        items: Array<{ action: string; message: string }>;
    };
}

export default function AIMessagesPage() {
    const params = useParams();
    const branchId = params.branchId as string;

    const [data, setData] = useState<AIResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [language, setLanguage] = useState<"en" | "hi">("en");

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const res = await fetch(`/api/ai/branch/${branchId}?lang=${language}`);
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
    }, [branchId, language]);

    return (
        <div className="p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <PageHeader
                    title="Message Drafts"
                    subtitle="Review and copy AI-drafted messages for your students."
                />
                <div className="flex items-center gap-2 bg-black/20 p-1 rounded-lg border border-white/5">
                    <Button
                        variant={language === 'en' ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setLanguage('en')}
                        className="text-xs"
                    >
                        English
                    </Button>
                    <Button
                        variant={language === 'hi' ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setLanguage('hi')}
                        className="text-xs"
                    >
                        हिंदी (Hindi)
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex h-96 items-center justify-center">
                    <Loader2 className="animate-spin text-primary" size={32} />
                </div>
            ) : !data || data.messages.items.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground border border-dashed border-white/10 rounded-lg mt-8">
                    <MessageSquare className="mx-auto mb-4 opacity-50" size={48} />
                    <p>No messages to draft right now.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {data.messages.items.map((item, i) => (
                        <MessageDraft
                            key={i}
                            draft={{ message: item.message, language: data.messages.language }}
                            actionType={item.action}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
