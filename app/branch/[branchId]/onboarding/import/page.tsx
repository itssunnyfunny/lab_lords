"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, FileText, TableProperties, UploadCloud } from "lucide-react";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { AppButton, AppPanel, PageShell } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { importSessions } from "@/lib/api/importSessions";
import { cn } from "@/lib/utils";
import type { ImportSessionListItem } from "@/importing/contracts/import-session.contract";
import { labelImportStatus, statusTone } from "@/importing/utils/import-wizard-view-model";
import {
    pageDescriptionClass,
    pageEyebrowClass,
    pageInsetSurfaceClass,
    pageMutedTextClass,
    pageTableBodyDividerClass,
    pageTitleClass,
} from "@/components/ui/pageSurface";

const supportedFormats = ["CSV", "XLSX", "XLS", "PDF", "Pasted table"];

function downloadSampleTemplate() {
    const csv = [
        "Name,Mobile,Seat No,Shift,Monthly Fee,Paid,Payment Method,Reference ID",
        "Asha Sharma,9876543210,A1,Morning,1200,yes,UPI,UPI123",
        "Ravi Kumar,9876543211,,Evening,1000,no,,",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lab-lords-import-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
}

export default function ImportAssistantPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [pastedTable, setPastedTable] = useState("");
    const [sessions, setSessions] = useState<ImportSessionListItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingSessions, setLoadingSessions] = useState(true);

    const canUpload = useMemo(() => Boolean(file || pastedTable.trim()), [file, pastedTable]);

    useEffect(() => {
        let alive = true;
        setLoadingSessions(true);
        importSessions.list(branchId)
            .then(value => {
                if (alive) setSessions(value as ImportSessionListItem[]);
            })
            .catch(() => {
                if (alive) setSessions([]);
            })
            .finally(() => {
                if (alive) setLoadingSessions(false);
            });

        return () => {
            alive = false;
        };
    }, [branchId]);

    const upload = async () => {
        if (!canUpload) return;
        setLoading(true);
        setError(null);
        try {
            const created = file
                ? await importSessions.createFromFile(branchId, file)
                : await importSessions.createFromPastedTable(branchId, pastedTable);
            router.push(`/branch/${branchId}/onboarding/import/${created.id}`);
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : "Import upload failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <BranchAccessGuard branchId={branchId} permission="students">
            <PageShell>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className={pageEyebrowClass}>Data onboarding</p>
                        <h1 className={pageTitleClass}>Import assistant</h1>
                        <p className={pageDescriptionClass}>
                            Upload a spreadsheet or paste a table. AI can help with column suggestions, but manual review always works.
                        </p>
                    </div>
                    <AppButton variant="quiet" icon={ArrowLeft} onClick={() => router.push(`/branch/${branchId}`)}>
                        Skip import
                    </AppButton>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
                    <AppPanel
                        title="Start an import"
                        description="Create a safe review workspace before any student, allocation, or payment record is created."
                    >
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div
                                className={cn(
                                    "flex min-h-56 flex-col items-center justify-center gap-4 rounded-[8px] border border-dashed p-6 text-center",
                                    pageInsetSurfaceClass
                                )}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    setFile(event.dataTransfer.files?.[0] ?? null);
                                }}
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-cyan-400/10 text-cyan-300">
                                    <UploadCloud size={22} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                                        {file ? file.name : "Drop a file here"}
                                    </p>
                                    <p className={cn("mt-1 text-xs", pageMutedTextClass)}>CSV, XLSX, XLS, or best-effort PDF.</p>
                                </div>
                                <div className="flex flex-wrap justify-center gap-2">
                                    <label className="inline-flex cursor-pointer">
                                        <input
                                            type="file"
                                            className="sr-only"
                                            accept=".csv,.xlsx,.xls,.pdf"
                                            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                                        />
                                        <span className="rounded-[var(--ui-radius-control)] border border-[color:var(--ui-button-secondary-border)] bg-[color:var(--ui-button-secondary-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--ui-button-secondary-text)]">
                                            Choose file
                                        </span>
                                    </label>
                                    {file && (
                                        <AppButton size="sm" variant="quiet" onClick={() => setFile(null)}>
                                            Clear
                                        </AppButton>
                                    )}
                                </div>
                            </div>

                            <label className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <TableProperties className="h-4 w-4 text-cyan-300" />
                                    <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
                                        Or paste a table
                                    </span>
                                </div>
                                <textarea
                                    value={pastedTable}
                                    onChange={(event) => {
                                        setPastedTable(event.target.value);
                                        if (event.target.value.trim()) setFile(null);
                                    }}
                                    rows={11}
                                    placeholder="Name\tMobile\tSeat No\tShift\tFee\tPaid"
                                    className="min-h-56 w-full rounded-[8px] border border-[color:var(--ui-form-field-border)] bg-[color:var(--ui-form-field-bg)] p-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--ui-form-field-focus-border)]"
                                />
                            </label>
                        </div>

                        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

                        <div className="mt-5 flex flex-wrap gap-3">
                            <AppButton variant="primary" icon={UploadCloud} onClick={upload} disabled={!canUpload} isLoading={loading}>
                                Create review workspace
                            </AppButton>
                            <AppButton variant="secondary" icon={FileSpreadsheet} onClick={downloadSampleTemplate}>
                                Download sample CSV
                            </AppButton>
                            <AppButton variant="quiet" onClick={() => router.push(`/branch/${branchId}`)}>
                                Continue without import
                            </AppButton>
                        </div>
                    </AppPanel>

                    <div className="space-y-5">
                        <AppPanel title="Supported inputs" description="PDF is best effort. Spreadsheets and pasted tables are more reliable.">
                            <div className="flex flex-wrap gap-2">
                                {supportedFormats.map(format => <Badge key={format} variant="cyan">{format}</Badge>)}
                            </div>
                            <div className="mt-5 space-y-3 text-sm text-[color:var(--text-secondary)]">
                                <div className="flex gap-3">
                                    <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                                    <span>Rows are staged first, then reviewed before final commit.</span>
                                </div>
                                <div className="flex gap-3">
                                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                                    <span>If parsing or AI mapping fails, manual mapping remains available.</span>
                                </div>
                            </div>
                        </AppPanel>

                        <AppPanel title="Recent imports" description="Resume a previous staging workspace." contentClassName="p-0">
                            {loadingSessions ? (
                                <p className={cn("p-4 text-sm", pageMutedTextClass)}>Loading sessions...</p>
                            ) : sessions.length === 0 ? (
                                <p className={cn("p-4 text-sm", pageMutedTextClass)}>No import sessions yet.</p>
                            ) : (
                                <div className={pageTableBodyDividerClass}>
                                    {sessions.slice(0, 8).map(session => (
                                        <button
                                            key={session.id}
                                            type="button"
                                            onClick={() => router.push(`/branch/${branchId}/onboarding/import/${session.id}`)}
                                            className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-white/[0.04]"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                                                    {session.fileName ?? session.sourceType}
                                                </p>
                                                <p className={cn("mt-1 text-xs", pageMutedTextClass)}>
                                                    {(session.summary?.totalRows ?? 0).toLocaleString("en-IN")} rows
                                                </p>
                                            </div>
                                            <Badge variant={statusTone(session.status)}>{labelImportStatus(session.status)}</Badge>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </AppPanel>
                    </div>
                </div>
            </PageShell>
        </BranchAccessGuard>
    );
}
