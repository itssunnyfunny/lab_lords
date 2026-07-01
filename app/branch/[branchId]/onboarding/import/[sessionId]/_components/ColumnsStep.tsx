import { useEffect, useMemo, useState } from "react";
import { Brain, Save } from "lucide-react";
import { AppButton, AppPanel } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { IMPORT_TARGET_FIELDS, type ImportColumnMapping } from "@/importing/contracts/import-session.contract";
import { aiAssistanceState } from "@/importing/utils/import-wizard-view-model";
import { pageInsetSurfaceClass, pageMutedTextClass, pageTableBodyDividerClass, pageTableHeadClass, pageTableRowClass } from "@/components/ui/pageSurface";
import { importOptionClass, importSelectClass, StepNotice } from "./shared";
import type { ImportDetail } from "./types";

type ColumnsStepProps = {
    detail: ImportDetail;
    saving: boolean;
    onSave: (columnMappings: ImportColumnMapping[]) => Promise<void>;
};

export function ColumnsStep({ detail, saving, onSave }: ColumnsStepProps) {
    const mapping = useMemo(() => detail.mapping?.columnMappings ?? [], [detail.mapping?.columnMappings]);
    const [draft, setDraft] = useState<ImportColumnMapping[]>(mapping);

    useEffect(() => {
        setDraft(mapping);
    }, [mapping]);

    const sourceColumns = useMemo(
        () => new Map((detail.mapping?.analysis?.sourceProfile?.columns ?? []).map(column => [column.column, column])),
        [detail.mapping?.analysis?.sourceProfile?.columns]
    );
    const mappingNeedsReview = draft.some(item => item.needsReview || item.targetField === "ignore");
    const aiState = aiAssistanceState({
        ai: detail.mapping?.analysis?.ai,
        usedFallback: detail.mapping?.usedFallback,
        mappingNeedsReview,
    });
    const changed = JSON.stringify(draft) !== JSON.stringify(mapping);
    const mappedCount = draft.filter(item => item.targetField !== "ignore").length;

    return (
        <div className="space-y-5">
            <AppPanel
                title="Column meanings"
                description="Confirm how each source column maps into the ERP. AI is only a suggestion layer."
                action={
                    <AppButton variant="primary" icon={Save} onClick={() => onSave(draft)} disabled={!changed} isLoading={saving}>
                        Save columns
                    </AppButton>
                }
            >
                <div className="space-y-4">
                    <StepNotice tone={aiState.tone} title={aiState.title} message={aiState.message} />

                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className={cn("p-3", pageInsetSurfaceClass)}>
                            <p className={cn("text-xs", pageMutedTextClass)}>Mapped columns</p>
                            <p className="mt-1 text-xl font-semibold text-[color:var(--text-primary)]">{mappedCount}</p>
                        </div>
                        <div className={cn("p-3", pageInsetSurfaceClass)}>
                            <p className={cn("text-xs", pageMutedTextClass)}>Needs review</p>
                            <p className="mt-1 text-xl font-semibold text-[color:var(--text-primary)]">
                                {draft.filter(item => item.needsReview || item.targetField === "ignore").length}
                            </p>
                        </div>
                        <div className={cn("p-3", pageInsetSurfaceClass)}>
                            <p className={cn("text-xs", pageMutedTextClass)}>AI mode</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <Badge variant={aiState.tone}>
                                    {detail.mapping?.analysis?.ai?.status?.replace(/_/g, " ") ?? "manual"}
                                </Badge>
                                {detail.mapping?.usedFallback && <Badge variant="warning">fallback</Badge>}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-[8px] border border-[color:var(--ui-table-border)]">
                        <table className="w-full min-w-[760px] text-left text-sm">
                            <thead className={pageTableHeadClass}>
                                <tr className="text-xs uppercase tracking-wide text-[color:var(--text-muted)]">
                                    <th className="p-3">Source column</th>
                                    <th className="p-3">ERP field</th>
                                    <th className="p-3">Confidence</th>
                                    <th className="p-3">Sample</th>
                                    <th className="p-3">Why</th>
                                </tr>
                            </thead>
                            <tbody className={pageTableBodyDividerClass}>
                                {draft.map((item, index) => {
                                    const profile = sourceColumns.get(item.sourceColumn);
                                    return (
                                        <tr key={item.sourceColumn} className={pageTableRowClass}>
                                            <td className="p-3">
                                                <div className="font-semibold text-[color:var(--text-primary)]">{item.sourceColumn}</div>
                                                {item.needsReview && <Badge className="mt-2" variant="warning">review</Badge>}
                                            </td>
                                            <td className="p-3">
                                                <select
                                                    value={item.targetField}
                                                    onChange={event => {
                                                        const next = [...draft];
                                                        next[index] = {
                                                            ...item,
                                                            targetField: event.target.value as ImportColumnMapping["targetField"],
                                                            source: "MANUAL",
                                                            needsReview: false,
                                                            autoApplied: event.target.value !== "ignore",
                                                        };
                                                        setDraft(next);
                                                    }}
                                                    className={cn("w-full", importSelectClass)}
                                                >
                                                    {IMPORT_TARGET_FIELDS.map(field => (
                                                        <option key={field} value={field} className={importOptionClass}>
                                                            {field}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-3">
                                                <Badge variant={item.confidence >= 85 ? "success" : item.confidence >= 60 ? "warning" : "default"}>
                                                    {Math.round(item.confidence)}%
                                                </Badge>
                                            </td>
                                            <td className={cn("max-w-[220px] p-3 text-xs", pageMutedTextClass)}>
                                                {profile?.sampleValues?.slice(0, 3).join(", ") || "-"}
                                            </td>
                                            <td className={cn("max-w-[260px] p-3 text-xs leading-5", pageMutedTextClass)}>
                                                {item.reason || "Manual mapping."}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </AppPanel>

            <AppPanel title="Manual-first fallback" description="The import does not depend on AI being available.">
                <div className="grid gap-3 md:grid-cols-3">
                    {[
                        ["AI suggests", "Column meanings and likely payment words are only suggestions."],
                        ["Checks decide", "Required fields, duplicates, conflicts, and payments are validated deterministically."],
                        ["You confirm", "Business records are created only from the final reviewed preview."],
                    ].map(([title, text]) => (
                        <div key={title} className={cn("p-3", pageInsetSurfaceClass)}>
                            <div className="flex items-center gap-2">
                                <Brain className="h-4 w-4 text-cyan-300" />
                                <p className="text-sm font-semibold text-[color:var(--text-primary)]">{title}</p>
                            </div>
                            <p className={cn("mt-2 text-xs leading-5", pageMutedTextClass)}>{text}</p>
                        </div>
                    ))}
                </div>
            </AppPanel>
        </div>
    );
}
