"use client";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppButton, Dialog } from "@/components/ui";
import { formControlClass } from "@/components/ui/formSurface";
import { feeCollections } from "@/lib/api/feeCollections";
import type { FeeCollectionView } from "@/lib/feeCollections";
import { FeeReceipt } from "./FeeReceipt";

export function CollectionHistory({ branchId, studentId, owner = false, refreshKey = 0 }: {
    branchId: string; studentId?: string; owner?: boolean; refreshKey?: number;
}) {
    const t = useTranslation();
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
    return <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("Collections & receipts")}</h2>
        <p className="text-sm text-[color:var(--text-muted)]">{t("Each instalment has its own receipt. Historical and imported payments without a generated receipt remain in fee history.")}</p>
        <div className="flex flex-wrap gap-3"><label className="text-sm">{t("Search student, receipt or reference")}<input className={`${formControlClass} min-h-11 px-3`} value={search} maxLength={100} onChange={e => setSearch(e.target.value)} /></label>
            <label className="text-sm">{t("Collection month")}<input type="month" className={`${formControlClass} min-h-11 px-3`} value={month} onChange={e => setMonth(e.target.value)} /></label></div>
        {error && <p role="alert">{t.error(error)} <AppButton variant="secondary" onClick={() => void load()}>{t("Retry")}</AppButton></p>}
        {rows.map(row => <div key={row.id} className="space-y-2 rounded border border-[color:var(--ui-form-surface-border)] p-3 text-sm">
            <p className="font-semibold">{row.snapshot.studentName} · ₹{row.amount} · {t.owned(row.method.replaceAll("_", " "))}{row.voidedAt ? " · VOID" : ""}</p>
            <p>{t("{toLocaleString2} · Recorded by {recordedBy}", { toLocaleString2: new Date(row.collectedAt).toLocaleString("en-IN"), recordedBy: row.snapshot.recordedBy })}</p>
            {row.reference && <p className="break-words">{t("Reference:")} {row.reference}</p>}
            <p className="break-all">{row.receiptNumber}</p>
            <div className="flex flex-wrap gap-2"><AppButton variant="secondary" onClick={() => void openReceipt(row.id)}>{t("View receipt")}</AppButton>
                {owner && !row.voidedAt && <AppButton variant="quiet" onClick={() => { setCorrection(row); setReason(""); }}>{t("Correct / void")}</AppButton>}</div>
        </div>)}
        {loading && <p role="status">{t("Loading collections…")}</p>}
        {!loading && !error && rows.length === 0 && <p>{t("No collections in this view.")}</p>}
        {cursor && <AppButton variant="secondary" disabled={loading} onClick={() => void load(cursor)}>{t("Load more collections")}</AppButton>}
        {selected && <Dialog open title={t("Fee payment receipt")} onClose={() => setSelected(null)} className="max-w-2xl"><FeeReceipt branchId={branchId} collection={selected} /></Dialog>}
        {correction && <Dialog open title={t("Void mistaken collection")} onClose={() => setCorrection(null)} closeDisabled={voiding}
            description={t("This corrects the app record. It does not return cash or initiate a provider refund. The receipt and reason remain in history.")}
            footer={<AppButton variant="primary" disabled={!reason.trim()} isLoading={voiding} onClick={() => void voidCollection()}>{t("Void collection")}</AppButton>}>
            <p className="mb-3">₹{correction.amount} · {correction.snapshot.studentName}</p>
            <label className="text-sm">{t("Required reason")}<textarea className={`${formControlClass} p-3`} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
            {error && <p role="alert">{t.error(error)}</p>}
        </Dialog>}
    </section>;
}
