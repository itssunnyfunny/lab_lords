"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { Loader2, MessageSquare, Copy, CheckCheck, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";

interface OverdueMessageDraft {
    studentId: string;
    studentName: string;
    dueDate: string;
    language: "en" | "hi";
    message: string;
    isOutdated?: boolean;
}

interface MessagesResponse {
    language: "en" | "hi";
    items: OverdueMessageDraft[];
}

function MessageCard({ draft }: { draft: OverdueMessageDraft }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(draft.message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className="p-5 space-y-3 border border-white/5">
            {/* Student info row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <User size={14} className="text-brand-400" />
                    <span className="text-white font-semibold text-sm">{draft.studentName}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-textSecondary">
                    <Calendar size={12} />
                    <span>Due: {format(new Date(draft.dueDate), "dd MMM yyyy")}</span>
                </div>
            </div>

            {/* Message */}
            {draft.isOutdated && (
                <div className="text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded">
                    ⚠ Student data has changed — consider regenerating
                </div>
            )}
            <p className="text-textSecondary text-sm leading-relaxed border-l-2 border-brand-500/40 pl-3">
                {draft.message}
            </p>

            {/* Copy button */}
            <div className="flex justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-xs text-textSecondary hover:text-white"
                    onClick={handleCopy}
                >
                    {copied ? (
                        <><CheckCheck size={14} className="text-green-400" /> Copied</>
                    ) : (
                        <><Copy size={14} /> Copy Message</>
                    )}
                </Button>
            </div>
        </Card>
    );
}

export default function AIMessagesPage() {
    const params = useParams();
    const branchId = params.branchId as string;

    return (
        <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.aiMessages}>
            <AIMessagesContent branchId={branchId} />
        </BranchAccessGuard>
    );
}

function AIMessagesContent({ branchId }: { branchId: string }) {
    const [data, setData] = useState<MessagesResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [language, setLanguage] = useState<"en" | "hi">("en");

    useEffect(() => {
        async function loadDefaultLanguage() {
            try {
                const [branchRes, userRes] = await Promise.all([
                    fetch(`/api/branches/${branchId}`),
                    fetch("/api/users/me"),
                ]);
                const branch = branchRes.ok ? await branchRes.json() : null;
                const user = userRes.ok ? await userRes.json() : null;
                const preferred = branch?.defaultMessageLanguage || user?.defaultMessageLanguage;
                if (preferred === "hi") setLanguage("hi");
            } catch (err) {
                console.error(err);
            }
        }
        loadDefaultLanguage();
    }, [branchId]);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const res = await fetch(`/api/ai/branch/${branchId}/messages?lang=${language}`);
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
                    subtitle="AI-drafted payment reminders for overdue students. Copy and send manually."
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
            ) : !data || data.items.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground border border-dashed border-white/10 rounded-lg mt-8">
                    <MessageSquare className="mx-auto mb-4 opacity-50" size={48} />
                    <p className="text-white font-medium mb-1">No overdue students</p>
                    <p className="text-textSecondary text-sm">All payments are up to date. No drafts needed.</p>
                </div>
            ) : (
                <>
                    <p className="text-textSecondary text-sm">
                        {data.items.length} student{data.items.length > 1 ? "s" : ""} with overdue payments
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {data.items.map((draft) => (
                            <MessageCard key={`${draft.studentId}-${draft.language}`} draft={draft} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
