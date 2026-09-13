import type { FeeCollectionView } from "@/lib/feeCollections";
import { translate, translateOwnedText } from "@/lib/i18n";
import { LANGUAGE_TAGS, type InterfaceLanguage } from "@/lib/i18n/language";
export function receiptSummary(collection: FeeCollectionView, language: InterfaceLanguage = "en") {
    const s = collection.snapshot;
    const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate(language, key, params);
    return [`Lab Lords · ${t("Fee payment receipt")}`, ...(collection.voidedAt ? [t("VOID — {reason}", { reason: collection.voidReason ?? "" })] : []),
        s.branchName, s.organizationName, s.address, s.contactPhone, t("Receipt: {number}", { number: collection.receiptNumber }),
        t("Student: {name} ({id})", { name: s.studentName, id: s.studentId }), new Date(s.collectedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST",
        t("Received: ₹{amount} · {method}", { amount: s.amount, method: translateOwnedText(language, s.method.replaceAll("_", " ")) }), s.reference ? t("Reference: {reference}", { reference: s.reference }) : null,
        ...s.allocations.map(a => t("{type}: {start} – {end} | Applied ₹{amount} | Remaining ₹{remaining}", { type: translateOwnedText(language, a.type), start: new Date(a.periodStart).toLocaleDateString("en-IN"), end: new Date(a.periodEnd).toLocaleDateString("en-IN"), amount: a.amount, remaining: a.remaining })),
        t("Student balance immediately after collection: ₹{amount}", { amount: s.remainingBalance }), t("Recorded by: {name}", { name: s.recordedBy }), s.note ? t("Note: {note}", { note: s.note }) : null,
    ].filter(Boolean).join("\n");
}

export async function feeReceiptFile(collection: FeeCollectionView, language: InterfaceLanguage = "en"): Promise<File> {
    const { jsPDF } = await import("jspdf");
    const devanagariFont = getComputedStyle(document.body).getPropertyValue("--font-devanagari").trim();
    const receiptFont = `26px ${devanagariFont || '"Nirmala UI"'}, "Noto Sans Devanagari", sans-serif`;
    await document.fonts.load(receiptFont, "फीस की रसीद");
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
    function clear() { ctx!.fillStyle = "#ffffff"; ctx!.fillRect(0, 0, canvas.width, canvas.height); ctx!.fillStyle = "#111827"; ctx!.font = receiptFont; if (logo) ctx!.drawImage(logo, 80, 40, 70, 70); y = logo ? 155 : 90; }
    function flush() { if (page++) pdf.addPage(); pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297); }
    clear();
    const graphemes = new Intl.Segmenter(LANGUAGE_TAGS[language], { granularity: "grapheme" });
    for (const paragraph of receiptSummary(collection, language).split("\n")) {
        let line = "";
        for (const { segment: char } of graphemes.segment(paragraph)) {
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
