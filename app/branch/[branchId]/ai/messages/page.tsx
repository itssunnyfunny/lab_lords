"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppButton, LoadingCardGrid, PageShell } from "@/components/ui";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { MessageSquare, Copy, CheckCheck, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { cn } from "@/lib/utils";
import { formWarningBannerClass } from "@/components/ui/formSurface";
import {
    pageCountBadgeClass,
    pageEmptyStateClass,
    pageFilterShellClass,
    pageGridCardClass,
    pageInsetSurfaceClass,
    pageMutedTextClass,
    pageSubtleTextClass,
} from "@/components/ui/pageSurface";

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
        <article className={cn(pageGridCardClass, "flex h-full flex-col gap-4")}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <User size={14} className="shrink-0 text-[color:var(--ui-badge-cyan-text)]" />
                        <h3 className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                            {draft.studentName}
                        </h3>
                    </div>
                    <p className={cn("mt-1 text-xs", pageSubtleTextClass)}>
                        Payment reminder draft
                    </p>
                </div>
                <div className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap", pageCountBadgeClass)}>
                    <Calendar size={12} />
                    <span>Due: {format(new Date(draft.dueDate), "dd MMM yyyy")}</span>
                </div>
            </div>

            {draft.isOutdated && (
                <div className={cn("px-3 py-2 text-xs", formWarningBannerClass)}>
                    Student data has changed. Consider regenerating.
                </div>
            )}

            <p className={cn("p-3 text-sm leading-6", pageInsetSurfaceClass, pageMutedTextClass)}>
                {draft.message}
            </p>

            <div className="mt-auto flex justify-end">
                <AppButton
                    variant="quiet"
                    size="sm"
                    icon={copied ? CheckCheck : Copy}
                    onClick={handleCopy}
                >
                    {copied ? "Copied" : "Copy message"}
                </AppButton>
            </div>
        </article>
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
        <div className="p-4 md:p-8">
            <PageShell>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <PageHeader
                        title="Message Drafts"
                        subtitle="AI-drafted payment reminders for overdue students. Copy and send manually."
                    />
                    <div className={cn("inline-flex w-fit items-center gap-1 p-1", pageFilterShellClass)}>
                        <AppButton
                            variant={language === "en" ? "primary" : "quiet"}
                            size="sm"
                            onClick={() => setLanguage("en")}
                        >
                            English
                        </AppButton>
                        <AppButton
                            variant={language === "hi" ? "primary" : "quiet"}
                            size="sm"
                            onClick={() => setLanguage("hi")}
                        >
                            Hindi
                        </AppButton>
                    </div>
                </div>

                {loading ? (
                    <LoadingCardGrid cards={4} />
                ) : !data || data.items.length === 0 ? (
                    <div className={pageEmptyStateClass}>
                        <MessageSquare className="mx-auto mb-4 opacity-60" size={42} />
                        <p className="mb-1 font-medium text-[color:var(--text-primary)]">No overdue students</p>
                        <p className={cn("text-sm", pageMutedTextClass)}>All payments are up to date. No drafts needed.</p>
                    </div>
                ) : (
                    <>
                        <p className={cn("text-sm", pageMutedTextClass)}>
                            {data.items.length} student{data.items.length > 1 ? "s" : ""} with overdue payments
                        </p>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            {data.items.map((draft) => (
                                <MessageCard key={`${draft.studentId}-${draft.language}`} draft={draft} />
                            ))}
                        </div>
                    </>
                )}
            </PageShell>
        </div>
    );
}
