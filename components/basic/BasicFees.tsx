"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ChevronRight } from "lucide-react";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { feeCollections } from "@/lib/api/feeCollections";
import type { PaymentListItem } from "@/lib/api/payments";
import type { FeeCollectionView } from "@/lib/feeCollections";
import { downloadFeeReceipt, feeReceiptFile } from "@/lib/feeReceiptPdf";
import { receiptCollectedAt, receiptPeriodDate } from "@/lib/feeReceiptDates";
import { remainingFee } from "@/lib/feeBalance";
import { BasicDialog } from "./BasicDialog";
import { initials } from "./data";

export function useBasicFormat() {
    const { formatNumber, formatDate } = useUserPreferences();
    return { money: (amount: number) => formatNumber(amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 }), date: formatDate };
}
export function BasicPaymentForm({ name, fees, pending, locked, error, onRecord, onClose, onDirty, onRecover }: {
    name: string; fees: PaymentListItem[]; pending: boolean; locked: boolean; error: string;
    onRecord: (amount: number, method: "CASH" | "UPI" | "BANK_TRANSFER", ids: string[]) => void; onClose: () => void; onDirty: () => void; onRecover?:()=>void;
}) {
    const t = useTranslation(), { money, date } = useBasicFormat();
    const dues = fees.filter(p => remainingFee(p) > 0).sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0,100);
    const [ids, setIds] = useState(dues.map(p => p.id));
    const balance = dues.filter(p => ids.includes(p.id)).reduce((sum,p) => sum + remainingFee(p),0);
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending || locked || !ids.length) return;
        const values = new FormData(event.currentTarget);
        onRecord(Number(values.get("amount")), String(values.get("method")) as "CASH" | "UPI" | "BANK_TRANSFER", ids);
    }
    return <BasicDialog title="Record a payment" onClose={onClose} pending={pending}>
        <div className="bp-person-summary"><span className="bp-avatar">{initials(name)}</span><strong>{name}</strong></div>
        <div className="bp-amount-due"><span>{t.owned("Amount left to pay")}</span><strong>{money(balance)}</strong></div>
        <form onSubmit={submit} onChange={onDirty}>
            <fieldset className="bp-form-fields" disabled={pending || locked}>
                <div className="bp-fee-selection">{dues.map(p => <label key={p.id}><input type="checkbox" checked={ids.includes(p.id)} onChange={e => setIds(current => e.target.checked ? [...current,p.id] : current.filter(id => id !== p.id))} />
                    <span>{t.owned(p.type === "ADMISSION" ? "Admission fee" : "Monthly fee")} · {date(p.dueDate)} <strong>{money(remainingFee(p))}</strong></span></label>)}</div>
                <label>{t.owned("Amount received")}<div className="bp-money-input"><span>₹</span><input key={balance} name="amount" aria-label={t.owned("Amount received")} type="number" min="1" max={balance} step="1" defaultValue={balance || ""} required data-dialog-initial-focus /></div><small>{t.owned("A part payment is fine. We’ll keep track of the rest.")}</small></label>
                <label>{t.owned("Received by")}<select name="method"><option value="CASH">{t("Cash")}</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">{t("Bank transfer")}</option></select></label>
                <p className="bp-subtle">{t.owned("Record money you have already received.")}</p>
            </fieldset>
            {error && <p role="alert" className="bp-error">{t.error(error)}</p>}
            {onRecover&&!pending&&<button type="button" className="bp-button bp-button-secondary" onClick={onRecover}>{t.owned("Check saved operation")}</button>}
            <footer className="bp-dialog-footer"><button className="bp-button bp-button-quiet" type="button" disabled={pending} onClick={onClose}>{t("Cancel")}</button><button className="bp-button bp-button-primary" disabled={pending || locked || !balance}><Check size={17} />{t.owned(pending ? "Recording…" : "Record payment")}</button></footer>
        </form>
    </BasicDialog>;
}
export function BasicReceipt({ branchId, receipt: initial, onClose }: { branchId: string; receipt: FeeCollectionView; onClose: () => void }) {
    const t = useTranslation(), { money } = useBasicFormat(), {documentLanguage}=useUserPreferences();
    const [receipt,setReceipt]=useState(initial), [busy,setBusy]=useState(false), [error,setError]=useState("");
    const snap=receipt.snapshot;
    async function download(){setBusy(true);setError("");try{const current=await feeCollections.get(branchId,receipt.id);setReceipt(current);downloadFeeReceipt(await feeReceiptFile(current,documentLanguage));}catch{setError("Receipt action could not be completed. Your collection remains recorded. Retry the receipt action below.");}finally{setBusy(false);}}
    return <BasicDialog title={receipt.voidedAt ? "Voided receipt" : "Fee receipt"} onClose={onClose}>
        <div className="bp-receipt">
            {!receipt.voidedAt && <span className="bp-success-mark"><Check size={28} /></span>}
            <p className="bp-receipt-amount">{money(receipt.amount)}</p><strong>{snap.studentName}</strong>
            <p>{snap.organizationName} · {snap.branchName}</p>
            <dl><div><dt>{t("Receipt")}</dt><dd>{receipt.receiptNumber}</dd></div><div><dt>{t("Date")}</dt><dd>{receiptCollectedAt(snap.collectedAt)}</dd></div><div><dt>{t.owned("Paid by")}</dt><dd>{t.owned(receipt.method.replaceAll("_"," "))}</dd></div>
                {snap.allocations.map(row => <div key={row.paymentId}><dt>{t.owned(row.type === "ADMISSION" ? "Admission fee" : "Monthly fee")}<small>{receiptPeriodDate(row.periodStart)} – {receiptPeriodDate(row.periodEnd)}</small></dt><dd>{money(row.amount)}</dd></div>)}</dl>
            <p className="bp-receipt-balance">{t.owned("Balance when recorded")}: {money(snap.remainingBalance)}</p>
            {receipt.voidedAt && <p className="bp-warning">{t.owned("Voided receipt")} · {receiptCollectedAt(receipt.voidedAt)} · {receipt.voidReason}</p>}
        </div>{error&&<p role="alert" className="bp-error">{t.owned(error)}</p>}<footer className="bp-dialog-footer"><button disabled={busy} className="bp-button bp-button-quiet" onClick={()=>void download()}>{t.owned("Download PDF")}</button><button className="bp-button bp-button-primary" onClick={onClose}>{t("Done")}</button></footer>
    </BasicDialog>;
}
export function BasicHistory({ branchId, studentId, revision, onReceipt }: { branchId: string; studentId?: string; revision: number; onReceipt: (receipt: FeeCollectionView) => void }) {
    const t = useTranslation(), { money } = useBasicFormat();
    const requestEpoch=useRef(0);
    const [items, setItems] = useState<FeeCollectionView[]>([]), [cursor,setCursor] = useState<string | null>(null), [error,setError] = useState(""), [loading,setLoading] = useState(true);
    useEffect(() => {
        let current = true; const epoch=requestEpoch; epoch.current++;
        setLoading(true); setError("");
        feeCollections.list(branchId, studentId ? { studentId } : {}).then(page => { if (current) { setItems(page.items); setCursor(page.nextCursor); } }).catch(() => { if(current) setError("Unable to load payment history."); }).finally(() => { if(current) setLoading(false); });
        return () => { current = false; epoch.current++; };
    }, [branchId,studentId,revision]);
    async function more() { const epoch=requestEpoch.current; setLoading(true); try { const page = await feeCollections.list(branchId, { ...(studentId ? {studentId}:{}), ...(cursor ? {cursor}: {}) }); if(epoch!==requestEpoch.current)return;setItems(current => [...current,...page.items]); setCursor(page.nextCursor); } catch { if(epoch===requestEpoch.current)setError("Unable to load payment history."); } finally { if(epoch===requestEpoch.current)setLoading(false); } }
    return <section className="bp-history"><h2>{t.owned("Payment history")}</h2>
        {error ? <p role="alert">{t.error(error)}</p> : items.map(item => <button key={item.id} onClick={() => onReceipt(item)}><span><strong>{money(item.amount)} {item.voidedAt ? t.owned("Voided") : ""}</strong><small>{item.snapshot.studentName} · {receiptCollectedAt(item.snapshot.collectedAt)}</small></span><span>{t.owned("View receipt")}<ChevronRight size={16} /></span></button>)}
        {loading && <p role="status">{t("Loading…")}</p>}
        {!loading && !error && !items.length && <p>{t.owned("No payments recorded yet.")}</p>}
        {cursor && <button disabled={loading} onClick={() => void more()}>{t("Load more")}</button>}
    </section>;
}
