"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, FileText, UploadCloud } from "lucide-react";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { AppButton, AppPanel, PageShell } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { importSessions } from "@/lib/api/importSessions";
import { cn } from "@/lib/utils";
import {
    pageDescriptionClass,
    pageEyebrowClass,
    pageInsetSurfaceClass,
    pageMutedTextClass,
    pageTitleClass,
} from "@/components/ui/pageSurface";

const supportedFormats = ["CSV", "XLSX", "XLS", "PDF", "Pasted table"];

export default function ImportAssistantPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [pastedTable, setPastedTable] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const canUpload = useMemo(() => Boolean(file || pastedTable.trim()), [file, pastedTable]);

    const upload = async () => {
        if (!canUpload) return;
        setLoading(true);
        setError(null);
        try {
            const created = file
                ? await importSessions.createFromFile(branchId, file)
                : await importSessions.createFromPastedTable(branchId, pastedTable);
            await importSessions.analyze(branchId, created.id);
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
                        <p className={pageEyebrowClass}>AI Data Onboarding</p>
                        <h1 className={pageTitleClass}>Import Assistant</h1>
                        <p className={pageDescriptionClass}>
                            Bring existing student, seat, shift, allocation, and payment records into this branch.
                        </p>
                    </div>
                    <AppButton variant="quiet" icon={ArrowLeft} onClick={() => router.push(`/branch/${branchId}`)}>
                        Continue with clean workspace
                    </AppButton>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
                    <AppPanel
                        title="Upload source data"
                        description="Use the old spreadsheet or paste a copied table from Sheets or Excel."
                    >
                        <div
                            className={cn(
                                "flex min-h-52 flex-col items-center justify-center gap-4 rounded-[8px] border border-dashed p-6 text-center",
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
                                    {file ? file.name : "Drop a file here or choose one"}
                                </p>
                                <p className={cn("mt-1 text-xs", pageMutedTextClass)}>CSV, XLSX, XLS, or best-effort PDF.</p>
                            </div>
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
                        </div>

                        <div className="mt-5 space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
                                Or paste a table
                            </label>
                            <textarea
                                value={pastedTable}
                                onChange={(event) => setPastedTable(event.target.value)}
                                rows={8}
                                placeholder="Name\tMobile\tSeat No\tShift\tFee\tPaid"
                                className="w-full rounded-[8px] border border-[color:var(--ui-form-field-border)] bg-[color:var(--ui-form-field-bg)] p-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--ui-form-field-focus-border)]"
                            />
                        </div>

                        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

                        <div className="mt-5 flex flex-wrap gap-3">
                            <AppButton variant="primary" icon={UploadCloud} onClick={upload} disabled={!canUpload} isLoading={loading}>
                                Upload and analyze
                            </AppButton>
                            <AppButton variant="secondary" icon={FileSpreadsheet} disabled title="Template download placeholder">
                                Sample template
                            </AppButton>
                        </div>
                    </AppPanel>

                    <AppPanel title="Supported imports" description="The assistant maps messy columns, then deterministic checks decide what is importable.">
                        <div className="flex flex-wrap gap-2">
                            {supportedFormats.map(format => <Badge key={format} variant="cyan">{format}</Badge>)}
                        </div>
                        <div className="mt-5 space-y-3 text-sm text-[color:var(--text-secondary)]">
                            <div className="flex gap-3">
                                <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                                <span>Excel and CSV are parsed into staging rows before any mutation is possible.</span>
                            </div>
                            <div className="flex gap-3">
                                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                                <span>PDF parsing is best effort; unreadable files ask for Excel, CSV, or pasted table.</span>
                            </div>
                        </div>
                    </AppPanel>
                </div>
            </PageShell>
        </BranchAccessGuard>
    );
}
