import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Copy, Check, MessageSquare } from 'lucide-react';
import { AIMessageDraft } from '@/ai/contracts/messageDraft.contract';

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
        <Card className="flex flex-col h-full bg-black/20 border-white/5 hover:border-white/10 transition-colors">
            <div className="p-4 flex-1 space-y-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase bg-primary/10 text-primary px-2 py-1 rounded border border-primary/20">
                        {actionType.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto bg-black/40 px-2 py-1 rounded">
                        {draft.language === 'en' ? 'English' : 'Hindi'}
                    </span>
                </div>

                <div className="bg-black/40 p-3 rounded-md border border-white/5 relative group">
                    {draft.isOutdated && (
                        <div className="absolute -top-3 right-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] px-2 py-0.5 rounded shadow-sm backdrop-blur-md flex items-center gap-1">
                            ⚠️ Outdated
                        </div>
                    )}
                    <p className="text-sm text-gray-300 italic min-h-[80px]">
                        "{draft.message}"
                    </p>
                </div>
            </div>

            <div className="p-3 border-t border-white/5 bg-white/5 flex justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="flex items-center gap-2 hover:bg-white/10"
                >
                    {copied ? (
                        <>
                            <Check className="h-4 w-4 text-green-400" />
                            <span className="text-green-400 text-xs">Copied</span>
                        </>
                    ) : (
                        <>
                            <Copy className="h-4 w-4" />
                            <span className="text-xs">Copy Text</span>
                        </>
                    )}
                </Button>
            </div>
        </Card>
    );
}
