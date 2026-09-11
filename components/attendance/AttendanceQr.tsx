"use client";
import { useEffect, useRef, useState } from "react";
import { AppButton } from "@/components/ui";
export function AttendanceQr({ code, name }: { code: string; name: string }) {
    const canvas = useRef<HTMLCanvasElement>(null), [error, setError] = useState(""), [ready, setReady] = useState(false);
    useEffect(() => {
        let cancelled = false;
        import("qrcode").then(async QRCode => {
            if (cancelled || !canvas.current) return;
            await QRCode.toCanvas(canvas.current, code, { width: 256, margin: 4, errorCorrectionLevel: "M" });
            if (!cancelled) setReady(true);
        }).catch(() => { if (!cancelled) setError("Unable to generate QR. Reopen this student to retry."); });
        return () => { cancelled = true; };
    }, [code]);
    function download() {
        const a = document.createElement("a"); a.href = canvas.current!.toDataURL("image/png"); a.download = "attendance-qr.png"; a.click();
    }
    function print() {
        const popup = window.open("", "_blank", "width=450,height=600");
        if (!popup) { setError("Allow the print window, or download the QR to print it."); return; }
        popup.opener = null;
        const heading = popup.document.createElement("h1"); heading.textContent = name;
        const img = popup.document.createElement("img"); img.alt = "Student attendance QR"; img.src = canvas.current!.toDataURL("image/png");
        const caption = popup.document.createElement("p"); caption.textContent = "Lab Lords · Supervised attendance";
        popup.document.body.append(heading, img, caption); img.onload = () => { popup.focus(); popup.print(); };
    }
    return <section className="space-y-3" aria-label="Student attendance QR">
        <canvas ref={canvas} aria-label={`Attendance QR for ${name}`} className="max-w-full rounded-lg" />
        {error && <p role="alert">{error}</p>}
        <div className="flex flex-wrap gap-2"><AppButton variant="secondary" disabled={!ready} onClick={download}>Download QR</AppButton><AppButton variant="secondary" disabled={!ready} onClick={print}>Print QR</AppButton></div>
        <p className="text-xs">This code contains an opaque attendance identifier. It grants no account access and is for supervised front-desk use.</p>
    </section>;
}
