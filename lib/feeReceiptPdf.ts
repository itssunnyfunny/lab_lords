import type { FeeCollectionView } from "@/lib/feeCollections";
export function receiptSummary(collection: FeeCollectionView) {
    const s = collection.snapshot;
    return ["Lab Lords · Fee payment receipt", ...(collection.voidedAt ? [`VOID — ${collection.voidReason}`] : []),
        s.branchName, s.organizationName, s.address, s.contactPhone, `Receipt: ${collection.receiptNumber}`,
        `Student: ${s.studentName} (${s.studentId})`, new Date(s.collectedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST",
        `Received: ₹${s.amount} · ${s.method.replaceAll("_", " ")}`, s.reference ? `Reference: ${s.reference}` : null,
        ...s.allocations.map(a => `${a.type}: ${new Date(a.periodStart).toLocaleDateString("en-IN")} – ${new Date(a.periodEnd).toLocaleDateString("en-IN")} | Applied ₹${a.amount} | Remaining ₹${a.remaining}`),
        `Student balance immediately after collection: ₹${s.remainingBalance}`, `Recorded by: ${s.recordedBy}`, s.note ? `Note: ${s.note}` : null,
    ].filter(Boolean).join("\n");
}

export async function feeReceiptFile(collection: FeeCollectionView): Promise<File> {
    const { jsPDF } = await import("jspdf");
    await document.fonts.ready;
    // Canvas uses the browser's Unicode fonts, including Indian student names.
    // Each bounded page becomes a high-resolution image inside the PDF.
    const canvas = document.createElement("canvas"); canvas.width = 1240; canvas.height = 1754;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Receipt rendering is unavailable");
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const svg = document.querySelector("[data-fee-receipt-logo]");
    let logo: HTMLImageElement | null = null;
    if (svg) {
        const candidate = new Image();
        candidate.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
        try { await candidate.decode(); logo = candidate; } catch { /* Text branding remains available. */ }
    }
    let y = 90, page = 0;
    function clear() { ctx!.fillStyle = "#ffffff"; ctx!.fillRect(0, 0, canvas.width, canvas.height); ctx!.fillStyle = "#111827"; ctx!.font = "26px sans-serif"; if (logo) ctx!.drawImage(logo, 80, 40, 70, 70); y = logo ? 155 : 90; }
    function flush() { if (page++) pdf.addPage(); pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297); }
    clear();
    for (const paragraph of receiptSummary(collection).split("\n")) {
        let line = "";
        for (const char of paragraph) {
            if (ctx.measureText(line + char).width > 1080) { ctx.fillText(line, 80, y); y += 40; line = ""; }
            if (y > 1650) { flush(); clear(); }
            line += char;
        }
        ctx.fillText(line, 80, y); y += 56;
        if (y > 1650) { flush(); clear(); }
    }
    if (y > 90) flush();
    return new File([pdf.output("blob")], `${collection.receiptNumber}${collection.voidedAt ? "-VOID" : ""}.pdf`, { type: "application/pdf" });
}
export function downloadFeeReceipt(file: File, printWindow: Window | null = null) {
    const url = URL.createObjectURL(file);
    if (printWindow) {
        printWindow.location.href = url;
    } else {
        const link = document.createElement("a"); link.href = url; link.download = file.name; link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
