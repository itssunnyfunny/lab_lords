"use client";
import { useState } from "react";
import { AppButton } from "@/components/ui";
import type { FeeCollectionView } from "@/lib/feeCollections";
import { feeCollections } from "@/lib/api/feeCollections";
import { downloadFeeReceipt, feeReceiptFile, receiptSummary } from "@/lib/feeReceiptPdf";
import { LogoMark } from "@/components/brand/AppLogo";

export function FeeReceipt({ branchId, collection }: { branchId: string; collection: FeeCollectionView }) {
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
            if (kind === "copy") { await navigator.clipboard.writeText(receiptSummary(current)); setStatus("Receipt summary copied. Delivery is not confirmed."); }
            else {
                const file = await feeReceiptFile(current);
                if (kind === "share" && navigator.canShare?.({ files: [file] })) {
                    await navigator.share({ files: [file], title: "Fee payment receipt" });
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
        <article className="space-y-3 rounded-lg border border-[color:var(--ui-form-surface-border)] p-4 text-sm">
            <div className="flex items-center gap-3"><LogoMark data-fee-receipt-logo className="h-9 w-9" /><p className="font-semibold">Lab Lords · {s.branchName}</p></div><h2 className="text-xl font-semibold">Fee payment receipt</h2>
            {display.voidedAt && <p className="text-xl font-bold text-red-500">VOID · {display.voidReason}</p>}
            <p>{s.organizationName}<br />{s.address}<br />{s.contactPhone}</p>
            <p className="break-all">Receipt: {collection.receiptNumber}</p>
            <p>{s.studentName}<br /><span className="break-all">Student: {s.studentId}</span></p>
            <p>{new Date(s.collectedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
            <p className="text-xl font-semibold">₹{s.amount} received · {s.method.replaceAll("_", " ")}</p>
            {s.reference && <p className="break-words">Reference: {s.reference}</p>}
            {s.allocations.map(a => <p key={a.paymentId}>{a.type} · {new Date(a.periodStart).toLocaleDateString("en-IN")} – {new Date(a.periodEnd).toLocaleDateString("en-IN")}<br />Applied ₹{a.amount} · Remaining ₹{a.remaining}</p>)}
            <p>Student balance immediately after collection: ₹{s.remainingBalance}</p><p>Recorded by: {s.recordedBy}</p>
            {s.note && <p className="break-words">Note: {s.note}</p>}
        </article>
        <div className="flex flex-wrap gap-2">{(["print", "download", "share", "copy"] as const).map(kind => <AppButton key={kind} variant="secondary" disabled={busy} onClick={() => void action(kind)}>
            {{ print: "Print", download: "Download PDF", share: "Share", copy: "Copy summary" }[kind]}</AppButton>)}</div>
        {status && <p role="status" className="text-sm">{status}</p>}
    </div>;
}
