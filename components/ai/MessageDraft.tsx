import React from "react";
import { AIMessageDraft } from "@/ai/contracts/messageDraft.contract";
import { AppButton, AppPanel } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { Check, Copy } from "lucide-react";

interface MessageDraftProps {
    draft: AIMessageDraft;
    actionType: string;
}

export function MessageDraft({ draft, actionType }: MessageDraftProps) {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(draft.message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <AppPanel className="flex h-full flex-col" contentClassName="flex flex-1 flex-col p-0">
            <div className="flex-1 space-y-4 p-4">
                <div className="flex items-center gap-2">
                    <Badge variant="cyan">{actionType.replace(/_/g, " ")}</Badge>
                    <span className="ml-auto rounded-full border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-muted-surface-bg)] px-2.5 py-1 text-xs text-[color:var(--text-secondary)]">
                        {draft.language === "en" ? "English" : "Hindi"}
                    </span>
                </div>

                <div className="relative rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-muted-surface-bg)] p-3">
                    {draft.isOutdated && (
                        <div className="absolute -top-3 right-2 rounded-full border border-[color:var(--ui-badge-warning-border)] bg-[color:var(--ui-badge-warning-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--ui-badge-warning-text)] shadow-[var(--ui-badge-warning-shadow)]">
                            Outdated
                        </div>
                    )}
                    <p className="min-h-[80px] text-sm leading-6 text-[color:var(--text-secondary)]">
                        {draft.message}
                    </p>
                </div>
            </div>

            <div className="flex justify-end border-t border-[color:var(--ui-form-section-divider)] bg-[color:var(--ui-form-muted-surface-bg)] p-3">
                <AppButton
                    variant="quiet"
                    size="sm"
                    icon={copied ? Check : Copy}
                    onClick={handleCopy}
                >
                    {copied ? "Copied" : "Copy text"}
                </AppButton>
            </div>
        </AppPanel>
    );
}
