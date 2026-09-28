"use client";
import { useState } from "react";
import { useTranslation } from "@/components/settings/LocalizedText";
import { LanguageControls } from "@/components/settings/LanguageControls";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { translate, translateOwnedText } from "@/lib/i18n";
import { LANGUAGE_TAGS } from "@/lib/i18n/language";
import { AppButton } from "@/components/ui";
import type { FeeCollectionView } from "@/lib/feeCollections";
import { feeCollections } from "@/lib/api/feeCollections";
import { downloadFeeReceipt, feeReceiptFile, receiptSummary } from "@/lib/feeReceiptPdf";
import { LogoMark } from "@/components/brand/AppLogo";
import { cn } from "@/lib/utils";
import { formErrorBannerClass, formHelpTextClass, formSuccessBannerClass, formSurfaceClass } from "@/components/ui/formSurface";

export function FeeReceipt({ branchId, collection }: { branchId: string; collection: FeeCollectionView }) {
    const t = useTranslation();
    const { documentLanguage } = useUserPreferences();
    const dt = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate(documentLanguage, key, params);
    const [status, setStatus] = useState("");
    const [busy, setBusy] = useState(false);
    const [display, setDisplay] = useState(collection);
    const s = display.snapshot;
    async function action(kind: "download" | "share" | "copy" | "print") {
        const printWindow = kind === "print" ? window.open("about:blank", "_blank") : null;
        if (printWindow) printWindow.opener = null;
        setBusy(true); setStatus("");
        try {
            // A historical snapshot stays fixed; VOID is always fetched afresh.
            const current = await feeCollections.get(branchId, collection.id);
            setDisplay(current);
            if (kind === "copy") { await navigator.clipboard.writeText(receiptSummary(current, documentLanguage)); setStatus("Receipt summary copied. Delivery is not confirmed."); }
            else {
                const file = await feeReceiptFile(current, documentLanguage);
                if (kind === "share" && navigator.canShare?.({ files: [file] })) {
                    await navigator.share({ files: [file], title: dt("Fee payment receipt") });
                    setStatus("Share action completed. Message delivery is not confirmed.");
                } else {
                    if (kind === "print" && !printWindow) throw new Error("Print window blocked");
                    downloadFeeReceipt(file, printWindow);
                    setStatus(kind === "print" ? "Receipt opened for printing. Use your PDF viewer’s Print action." : kind === "share" ? "File sharing is unavailable. PDF downloaded; you can also copy the summary." : "PDF downloaded.");
                }
            }
        } catch { printWindow?.close(); setStatus("Receipt action could not be completed. Your collection remains recorded. Retry the receipt action below."); }
        finally { setBusy(false); }
    }
    return <div className="space-y-4">
        <div className="flex justify-end">
            <LanguageControls documentOnly />
        </div>
        <article
            lang={LANGUAGE_TAGS[documentLanguage]}
            className="overflow-hidden rounded-[var(--ui-dialog-radius)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-input-bg)] text-sm shadow-[var(--ui-panel-shadow)]"
        >
            <div className="flex flex-col gap-4 border-b border-[color:var(--ui-form-section-divider)] bg-[color:var(--ui-form-muted-surface-bg)] p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <LogoMark data-fee-receipt-logo className="h-10 w-10" />
                    <div className="min-w-0">
                        <p className="truncate font-semibold text-[color:var(--ui-form-label-strong)]">Lab Lords · {s.branchName}</p>
                        <h2 className="mt-1 text-xl font-semibold text-[color:var(--ui-dialog-title)]">{dt("Fee payment receipt")}</h2>
                    </div>
                </div>
                <div className="sm:text-right">
                    <p className="break-all font-mono text-xs text-[color:var(--ui-form-help)]">
                        {dt("Receipt: {number}", { number: collection.receiptNumber })}
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--ui-form-help)]">
                        {new Date(s.collectedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                    </p>
                </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
                {display.voidedAt && (
                    <p className={cn("p-3 text-base font-bold", formErrorBannerClass)}>
                        {dt("VOID — {reason}", { reason: display.voidReason ?? "" })}
                    </p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                    <div className={cn("p-3 leading-6", formSurfaceClass)}>
                        <p className="break-words font-semibold text-[color:var(--ui-form-label-strong)]">
                            {dt("Student: {name} ({id})", { name: s.studentName, id: s.studentId })}
                        </p>
                        <p className={cn("mt-2", formHelpTextClass)}>{dt("Recorded by: {name}", { name: s.recordedBy })}</p>
                    </div>
                    <div className={cn("p-3 leading-6", formSurfaceClass)}>
                        <p className="font-semibold text-[color:var(--ui-form-label-strong)]">{s.organizationName}</p>
                        <p className={cn("mt-1", formHelpTextClass)}>{s.address}<br />{s.contactPhone}</p>
                    </div>
                </div>

                <div className={cn("p-4", formSuccessBannerClass)}>
                    <p className="text-xl font-semibold">
                        {dt("Received: ₹{amount} · {method}", { amount: s.amount, method: translateOwnedText(documentLanguage, s.method.replaceAll("_", " ")) })}
                    </p>
                    {s.reference && <p className="mt-1 break-words text-sm">{dt("Reference: {reference}", { reference: s.reference })}</p>}
                </div>

                <div className="space-y-2">
                    {s.allocations.map(a => (
                        <p key={a.paymentId} className={cn("p-3 leading-6", formSurfaceClass)}>
                            {dt("{type}: {start} – {end} | Applied ₹{amount} | Remaining ₹{remaining}", { type: translateOwnedText(documentLanguage, a.type), start: new Date(a.periodStart).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }), end: new Date(a.periodEnd).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }), amount: a.amount, remaining: a.remaining })}
                        </p>
                    ))}
                </div>

                <p className="font-semibold text-[color:var(--ui-form-label-strong)]">
                    {dt("Student balance immediately after collection: ₹{amount}", { amount: s.remainingBalance })}
                </p>
                {s.note && <p className={cn("break-words p-3", formSurfaceClass)}>{dt("Note: {note}", { note: s.note })}</p>}
            </div>
        </article>
        <div className="flex flex-wrap gap-2">
            {(["print", "download", "share", "copy"] as const).map(kind => (
                <AppButton key={kind} variant="secondary" density="compact" disabled={busy} onClick={() => void action(kind)}>
                    {t.owned({ print: "Print", download: "Download PDF", share: "Share", copy: "Copy summary" }[kind])}
                </AppButton>
            ))}
        </div>
        {status && <p role="status" className={cn("p-3 text-sm", formSurfaceClass)}>{t.owned(status)}</p>}
    </div>;
}
