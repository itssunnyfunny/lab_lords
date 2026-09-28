"use client";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppButton, AppPanel, Dialog } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { formControlClass, formErrorBannerClass, formLabelClass } from "@/components/ui/formSurface";
import { pageGridCardClass, pageMutedTextClass, pageSubtleTextClass } from "@/components/ui/pageSurface";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { cn } from "@/lib/utils";
import { feeCollections } from "@/lib/api/feeCollections";
import type { FeeCollectionView } from "@/lib/feeCollections";
import { FeeReceipt } from "./FeeReceipt";

export function CollectionHistory({ branchId, studentId, owner = false, refreshKey = 0 }: {
    branchId: string; studentId?: string; owner?: boolean; refreshKey?: number;
}) {
    const t = useTranslation();
    const { formatDateTime, formatNumber } = useUserPreferences();
    const [rows, setRows] = useState<FeeCollectionView[]>([]);
    const [search, setSearch] = useState("");
    const [month, setMonth] = useState("");
    const [cursor, setCursor] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<FeeCollectionView | null>(null);
    const [correction, setCorrection] = useState<FeeCollectionView | null>(null);
    const [reason, setReason] = useState("");
    const [voiding, setVoiding] = useState(false);
    const requestVersion = useRef(0);
    const load = useCallback(async (after?: string) => {
        const version = ++requestVersion.current;
        setLoading(true); setError("");
        try {
            const result = await feeCollections.list(branchId, { ...(studentId ? { studentId } : {}), search, month, ...(after ? { cursor: after } : {}) });
            if (version !== requestVersion.current) return;
            setRows(previous => after ? [...previous, ...result.items] : result.items); setCursor(result.nextCursor);
        } catch (err) { if (version === requestVersion.current) setError(err instanceof Error ? err.message : "Unable to load collection history"); }
        finally { if (version === requestVersion.current) setLoading(false); }
    }, [branchId, studentId, search, month]);
    useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [load, refreshKey]);
    useEffect(() => { const refresh = () => void load(); window.addEventListener("fee-collection-changed", refresh); return () => window.removeEventListener("fee-collection-changed", refresh); }, [load]);
    async function voidCollection() {
        if (!correction || voiding) return;
        setVoiding(true); setError("");
        try {
            await feeCollections.void(branchId, correction.id, reason);
            setCorrection(null); setReason(""); await load(); window.dispatchEvent(new Event("fee-collection-changed"));
        } catch (err) { setError(err instanceof Error ? err.message : "Correction could not be confirmed. Retry safely."); }
        finally { setVoiding(false); }
    }
    async function openReceipt(id: string) {
        try { setSelected(await feeCollections.get(branchId, id)); }
        catch { setError("Unable to retrieve the receipt. Retry View receipt; the collection remains recorded."); }
    }
    return <>
        <AppPanel density="compact" padding="none" title={t("Collections & receipts")}
            description={t("Each instalment has its own receipt. Historical and imported payments without a generated receipt remain in fee history.")}
            aria-busy={loading || undefined}>
            <div className="ui-record-toolbar">
                <label className={cn("block min-w-0 flex-1 space-y-1 sm:min-w-64", formLabelClass)}>
                    {t("Search student, receipt or reference")}
                    <input type="search" className={`${formControlClass} min-h-11 w-full px-3`} value={search} maxLength={100} onChange={e => setSearch(e.target.value)} />
                </label>
                <label className={cn("block space-y-1", formLabelClass)}>
                    {t("Collection month")}
                    <input type="month" className={`${formControlClass} min-h-11 px-3`} value={month} onChange={e => setMonth(e.target.value)} />
                </label>
            </div>
            <div className="ui-record-results">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {error && <div role="alert" className={cn("col-span-full flex flex-wrap items-center gap-3 p-3 text-sm", formErrorBannerClass)}>
                        <span>{t.error(error)}</span><AppButton variant="secondary" density="compact" onClick={() => void load()}>{t("Retry")}</AppButton>
                    </div>}
                    {rows.map(row => <article key={row.id} className={cn(pageGridCardClass, "ui-record-card")}>
                        <div className="ui-record-card-identity">
                            <Avatar name={row.snapshot.studentName} size="sm" tone="quiet" />
                            <div className="min-w-0 flex-1">
                                <p className="ui-record-card-name">{row.snapshot.studentName}</p>
                                <p className="ui-record-card-meta break-all">{row.receiptNumber}</p>
                            </div>
                            {row.voidedAt && <Badge variant="danger">{t("VOID")}</Badge>}
                        </div>
                        <div className="ui-record-card-context">
                            <span>{t("{toLocaleString2} · Recorded by {recordedBy}", { toLocaleString2: formatDateTime(row.collectedAt), recordedBy: row.snapshot.recordedBy })}</span>
                        </div>
                        <div className="ui-record-card-summary">
                            <p className="ui-record-card-due">{formatNumber(row.amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</p>
                            <p className={pageMutedTextClass}>{t.owned(row.method.replaceAll("_", " "))}</p>
                            {row.reference && <p className={cn("mt-1 break-words", pageSubtleTextClass)}>{t("Reference:")} {row.reference}</p>}
                            <div className="mt-3 flex flex-wrap gap-2">
                                <AppButton variant="secondary" density="compact" onClick={() => void openReceipt(row.id)}>{t("View receipt")}</AppButton>
                                {owner && !row.voidedAt && <AppButton variant="quiet" density="compact" onClick={() => { setCorrection(row); setReason(""); }}>{t("Correct / void")}</AppButton>}
                            </div>
                        </div>
                    </article>)}
                    {loading && <p role="status" className={cn("col-span-full text-sm", pageMutedTextClass)}>{t("Loading collections…")}</p>}
                    {!loading && !error && rows.length === 0 && <p className={cn("col-span-full py-10 text-center text-sm", pageMutedTextClass)}>{t("No collections in this view.")}</p>}
                </div>
            </div>
            {cursor && <div className="ui-record-footer flex justify-center"><AppButton variant="secondary" density="compact" disabled={loading} onClick={() => void load(cursor)}>{t("Load more collections")}</AppButton></div>}
        </AppPanel>
        {selected && <Dialog open density="compact" title={t("Fee payment receipt")} onClose={() => setSelected(null)} className="max-w-2xl"><FeeReceipt branchId={branchId} collection={selected} /></Dialog>}
        {correction && <Dialog open density="compact" languagePlacement="header" title={t("Void mistaken collection")} onClose={() => setCorrection(null)} closeDisabled={voiding}
            description={t("This corrects the app record. It does not return cash or initiate a provider refund. The receipt and reason remain in history.")}
            footer={<AppButton variant="danger" density="compact" disabled={!reason.trim()} isLoading={voiding} onClick={() => void voidCollection()}>{t("Void collection")}</AppButton>}>
            <p className="mb-3">₹{correction.amount} · {correction.snapshot.studentName}</p>
            <label className={cn("block space-y-1", formLabelClass)}>{t("Required reason")}<textarea className={`${formControlClass} min-h-24 w-full p-3`} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
            {error && <p role="alert" className={cn("mt-3 p-3 text-sm", formErrorBannerClass)}>{t.error(error)}</p>}
        </Dialog>}
    </>;
}
