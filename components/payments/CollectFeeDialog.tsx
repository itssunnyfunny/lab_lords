"use client";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useEffect, useRef, useState } from "react";
import { AppButton, Dialog } from "@/components/ui";
import {
    formCheckboxClass,
    formControlClass,
    formErrorBannerClass,
    formHelpTextClass,
    formLabelClass,
    formSurfaceClass,
    formWarningBannerClass,
} from "@/components/ui/formSurface";
import { feeCollections } from "@/lib/api/feeCollections";
import { allocateCollection, remainingFee } from "@/lib/feeBalance";
import { collectionInputSchema, type CollectionInput, type FeeCollectionView } from "@/lib/feeCollections";
import type { PaymentListItem } from "@/lib/api/payments";
import { cn } from "@/lib/utils";
import { FeeReceipt } from "./FeeReceipt";

export function CollectFeeDialog({ branchId, studentId, paymentId, onClose, onSaved }: {
    branchId: string; studentId: string; paymentId?: string; onClose: () => void; onSaved: () => void;
}) {
    const t = useTranslation();
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
    const studentOutstanding = dues.reduce((sum, payment) => sum + remainingFee(payment), 0);
    const projectedStudentBalance = valid ? Math.max(studentOutstanding - Number(amount), 0) : studentOutstanding;
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
    return <Dialog
        open
        onClose={onClose}
        closeDisabled={busy}
        title={receipt ? t("Collection recorded") : t("Collect fee")}
        description={name}
        className="max-w-4xl"
        overlayClassName="app-design-pilot-overlay"
        footer={!receipt ? <>
            <AppButton variant="quiet" onClick={onClose} disabled={busy}>{t("Close")}</AppButton>
            <AppButton variant="primary" onClick={() => void confirm()} isLoading={busy} disabled={loading || (!pending && !valid)}>
                {pending ? t("Retry same collection") : t("Confirm collection")}
            </AppButton>
        </> : undefined}
    >
        {receipt ? <FeeReceipt branchId={branchId} collection={receipt} /> : <div className="space-y-4">
            {loading && (
                <p role="status" className={cn("p-3 text-sm", formSurfaceClass, formHelpTextClass)}>
                    {t("Loading outstanding dues…")}
                </p>
            )}
            {error && (
                <p role="alert" className={cn("p-3 text-sm font-medium", formErrorBannerClass)}>
                    {t.error(error, pending ? "Unable to confirm the result. Retry the same request." : "Something went wrong. Try again.")}
                </p>
            )}
            {pending && (
                <p role="status" className={cn("p-3 text-sm leading-6", formWarningBannerClass)}>
                    {t("This request may already be recorded. Retry to retrieve its receipt safely. Its amount and selections are locked until confirmed.")}
                </p>
            )}

            <fieldset disabled={busy || !!pending || loading}>
                <legend className={cn("mb-3 text-sm", formHelpTextClass)}>
                    {t("Select up to 100 existing dues · oldest selected fee receives money first")}
                </legend>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.85fr)]">
                    <div className="min-w-0 space-y-2">
                        <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                            {dues.map(p => {
                                const isSelected = selected.includes(p.id);
                                return (
                                    <label
                                        key={p.id}
                                        className={cn(
                                            "flex min-h-11 cursor-pointer gap-3 rounded-[var(--ui-radius-control)] border p-3 text-sm transition-colors",
                                            isSelected
                                                ? "border-[color:var(--ui-form-input-focus-border)] bg-[color:var(--ui-form-info-bg)]"
                                                : "border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)] hover:bg-[color:var(--ui-form-surface-hover-bg)]"
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            className={cn(formCheckboxClass, "mt-0.5 shrink-0")}
                                            checked={isSelected}
                                            disabled={selected.length >= 100 && !isSelected}
                                            onChange={event => {
                                                const ids = event.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id);
                                                setSelected(ids);
                                                setAmount(String(dues.filter(d => ids.includes(d.id)).reduce((sum, d) => sum + remainingFee(d), 0)));
                                            }}
                                        />
                                        <span className="min-w-0 leading-5 text-[color:var(--ui-form-label)]">
                                            <span className="block font-semibold text-[color:var(--ui-form-label-strong)]">
                                                {p.type === "ADMISSION" ? t("Admission") : t("Monthly")} · {new Date(p.periodStart).toLocaleDateString("en-IN")} – {new Date(p.periodEnd).toLocaleDateString("en-IN")}
                                            </span>
                                            <span className={cn("mt-1 block", formHelpTextClass)}>
                                                {t("Fee ₹{fee} · Collected ₹{collected} · Waived ₹{waived} · Remaining ₹{remaining}", { fee: p.amount, collected: p.collectedAmount, waived: p.waivedAmount, remaining: remainingFee(p) })}
                                                {p.collectedAmount > 0 && <strong className="text-[color:var(--ui-tone-warning-text)]"> {t("· Partially paid")}</strong>}
                                            </span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                        {!loading && dues.length === 0 && (
                            <p className={cn("p-4 text-sm leading-6", formSurfaceClass, formHelpTextClass)}>
                                {t("No collectible dues. Expected fees must first be generated through the existing fee process.")}
                            </p>
                        )}
                    </div>

                    <div className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start">
                        <label className={cn("block space-y-1.5", formLabelClass)}>
                            {t("Amount received (whole ₹)")}
                            <input className={`${formControlClass} min-h-11 px-3`} inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} />
                        </label>
                        <label className={cn("block space-y-1.5", formLabelClass)}>
                            {t("Payment method")}
                            <select className={`${formControlClass} min-h-11 px-3`} value={method} onChange={e => setMethod(e.target.value as CollectionInput["method"])}>
                                <option value="CASH">{t("Cash")}</option>
                                <option value="UPI">UPI</option>
                                <option value="BANK_TRANSFER">{t("Bank Transfer")}</option>
                            </select>
                        </label>
                        <label className={cn("block space-y-1.5", formLabelClass)}>
                            {t("Reference (optional)")}
                            <input className={`${formControlClass} min-h-11 px-3`} maxLength={200} value={reference} onChange={e => setReference(e.target.value)} />
                        </label>
                        <label className={cn("block space-y-1.5", formLabelClass)}>
                            {t("Note (shown on receipt, optional)")}
                            <textarea className={`${formControlClass} min-h-24 p-3`} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} />
                        </label>

                        {!pending && (
                            <div className={cn("space-y-2 p-3 text-sm", formSurfaceClass)}>
                                <p className="font-semibold text-[color:var(--ui-form-label-strong)]">
                                    {t("Selected outstanding balance: ₹{amount}", { amount: total })}
                                </p>
                                {preview.map(a => (
                                    <p key={a.payment.id} className={formHelpTextClass}>
                                        {t("{date}: apply ₹{amount} · ₹{remaining} remains", { date: new Date(a.payment.periodStart).toLocaleDateString("en-IN"), amount: a.amount, remaining: a.remaining })}
                                    </p>
                                ))}
                                {valid ? (
                                    <p className="border-t border-[color:var(--ui-form-section-divider)] pt-2 font-semibold text-[color:var(--ui-tone-success-text)]">
                                        {t("Expected student balance after confirmation: ₹{amount}", { amount: projectedStudentBalance })}
                                    </p>
                                ) : (
                                    <p className="text-[color:var(--ui-form-error-text)]">
                                        {t("Enter a positive whole-rupee amount within the selected balance.")}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </fieldset>
        </div>}
    </Dialog>;
}
