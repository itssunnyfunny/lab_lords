"use client";
import { useEffect, useRef, useState } from "react";
import { AppButton, Dialog } from "@/components/ui";
import { formControlClass } from "@/components/ui/formSurface";
import { feeCollections } from "@/lib/api/feeCollections";
import { allocateCollection, remainingFee } from "@/lib/feeBalance";
import { collectionInputSchema, type CollectionInput, type FeeCollectionView } from "@/lib/feeCollections";
import type { PaymentListItem } from "@/lib/api/payments";
import { FeeReceipt } from "./FeeReceipt";

export function CollectFeeDialog({ branchId, studentId, paymentId, onClose, onSaved }: {
    branchId: string; studentId: string; paymentId?: string; onClose: () => void; onSaved: () => void;
}) {
    const [dues, setDues] = useState<PaymentListItem[]>([]);
    const [name, setName] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [amount, setAmount] = useState("");
    const [method, setMethod] = useState<CollectionInput["method"]>("CASH");
    const [reference, setReference] = useState("");
    const [note, setNote] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [pending, setPending] = useState<CollectionInput | null>(null);
    const [receipt, setReceipt] = useState<FeeCollectionView | null>(null);
    const inFlight = useRef(false);
    const storageKey = `fee-collection:${branchId}:${studentId}`;
    useEffect(() => {
        let active = true;
        async function load() {
            try {
                const response = await feeCollections.dues(branchId, studentId);
                if (!active) return;
                setDues(response.payments); setName(response.student.name);
                const initial = response.payments.filter(p => paymentId ? p.id === paymentId : true).slice(0, 100);
                setSelected(initial.map(p => p.id)); setAmount(String(initial.reduce((sum, p) => sum + remainingFee(p), 0)));
                const stored = sessionStorage.getItem(storageKey);
                if (stored) {
                    const parsed = collectionInputSchema.safeParse(JSON.parse(stored));
                    if (parsed.success && parsed.data.studentId === studentId) {
                        setPending(parsed.data); setSelected(parsed.data.paymentIds); setAmount(String(parsed.data.amount));
                        setMethod(parsed.data.method); setReference(parsed.data.reference); setNote(parsed.data.note);
                    }
                }
            } catch { if (active) setError("Unable to load dues. Close and reopen to retry."); }
            finally { if (active) setLoading(false); }
        }
        void load(); return () => { active = false; };
    }, [branchId, studentId, paymentId, storageKey]);
    const selectedDues = dues.filter(p => selected.includes(p.id));
    const total = selectedDues.reduce((sum, p) => sum + remainingFee(p), 0);
    let preview: ReturnType<typeof allocateCollection<PaymentListItem>> = [];
    try { preview = allocateCollection(selectedDues, Number(amount)); } catch { /* Inline validation below. */ }
    const valid = /^\d+$/.test(amount) && Number(amount) > 0 && Number(amount) <= Math.min(total, 2147483647) && preview.length > 0;
    async function confirm() {
        if (inFlight.current || (!pending && !valid)) return;
        inFlight.current = true; setBusy(true); setError(null);
        const request = pending ?? { studentId, paymentIds: selected, amount: Number(amount), method, reference, note, idempotencyKey: crypto.randomUUID() };
        try {
            // Save before dispatch. An uncertain response never creates a fresh key.
            sessionStorage.setItem(storageKey, JSON.stringify(request)); setPending(request);
            const response = await fetch(`/api/branches/${branchId}/collections`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
            });
            const body = await response.json();
            if (!response.ok) {
                // A permission change after an uncertain commit cannot prove that
                // the earlier request failed. Retain its key until recovered.
                if (response.status === 400 || (!pending && [403, 404].includes(response.status))) {
                    sessionStorage.removeItem(storageKey); setPending(null);
                }
                throw new Error(body.error || "Unable to confirm the collection. Retry this request.");
            }
            setReceipt(body); setPending(null); sessionStorage.removeItem(storageKey);
            window.dispatchEvent(new Event("fee-collection-changed"));
            onSaved();
        } catch (err) { setError(err instanceof Error ? err.message : "Unable to confirm the result. Retry the same request."); }
        finally { inFlight.current = false; setBusy(false); }
    }
    return <Dialog open onClose={onClose} closeDisabled={busy} title={receipt ? "Collection recorded" : "Collect fee"}
        description={name} className="max-w-2xl" footer={!receipt ? <>
            <AppButton variant="quiet" onClick={onClose} disabled={busy}>Close</AppButton>
            <AppButton variant="primary" onClick={() => void confirm()} isLoading={busy} disabled={loading || (!pending && !valid)}>
                {pending ? "Retry same collection" : "Confirm collection"}
            </AppButton></> : undefined}>
        {receipt ? <FeeReceipt branchId={branchId} collection={receipt} /> : <div className="space-y-4">
            {loading && <p role="status">Loading outstanding dues…</p>}
            {error && <p role="alert">{error}</p>}
            {pending && <p role="status">This request may already be recorded. Retry to retrieve its receipt safely. Its amount and selections are locked until confirmed.</p>}
            <fieldset disabled={busy || !!pending || loading} className="space-y-4">
                <legend className="text-sm">Select up to 100 existing dues · oldest selected fee receives money first</legend>
                <div className="max-h-60 space-y-2 overflow-y-auto">
                    {dues.map(p => <label key={p.id} className="flex min-h-11 gap-3 rounded border border-[color:var(--ui-form-surface-border)] p-3 text-sm">
                        <input type="checkbox" checked={selected.includes(p.id)} disabled={selected.length >= 100 && !selected.includes(p.id)} onChange={event => {
                            const ids = event.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id);
                            setSelected(ids); setAmount(String(dues.filter(d => ids.includes(d.id)).reduce((sum, d) => sum + remainingFee(d), 0)));
                        }} />
                        <span>{p.type === "ADMISSION" ? "Admission" : "Monthly"} · {new Date(p.periodStart).toLocaleDateString("en-IN")} – {new Date(p.periodEnd).toLocaleDateString("en-IN")}<br />
                            Fee ₹{p.amount} · Collected ₹{p.collectedAmount} · Waived ₹{p.waivedAmount} · Remaining ₹{remainingFee(p)}
                            {p.collectedAmount > 0 && <strong> · Partially paid</strong>}</span>
                    </label>)}
                </div>
                {!loading && dues.length === 0 && <p>No collectible dues. Expected fees must first be generated through the existing fee process.</p>}
                <label className="block space-y-1 text-sm">Amount received (whole ₹)
                    <input className={`${formControlClass} min-h-11 px-3`} inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} /></label>
                <label className="block space-y-1 text-sm">Payment method<select className={`${formControlClass} min-h-11 px-3`} value={method} onChange={e => setMethod(e.target.value as CollectionInput["method"])}>
                    <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank Transfer</option></select></label>
                <label className="block space-y-1 text-sm">Reference (optional)<input className={`${formControlClass} min-h-11 px-3`} maxLength={200} value={reference} onChange={e => setReference(e.target.value)} /></label>
                <label className="block space-y-1 text-sm">Note (shown on receipt, optional)<textarea className={`${formControlClass} p-3`} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>
            </fieldset>
            {!pending && <div className="space-y-2 rounded border border-[color:var(--ui-form-surface-border)] p-3 text-sm">
                <p>Selected outstanding balance: ₹{total}</p>
                {preview.map(a => <p key={a.payment.id}>{new Date(a.payment.periodStart).toLocaleDateString("en-IN")}: apply ₹{a.amount} · ₹{a.remaining} remains</p>)}
                {!valid && <p>Enter a positive whole-rupee amount within the selected balance.</p>}
            </div>}
        </div>}
    </Dialog>;
}
