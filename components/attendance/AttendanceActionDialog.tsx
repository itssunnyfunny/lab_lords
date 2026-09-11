"use client";
import { useRef, useState } from "react";
import { AppButton, Dialog } from "@/components/ui";
import { formControlClass } from "@/components/ui/formSurface";
import { attendance, AttendanceRequestError, type AttendanceResult } from "@/lib/api/attendance";
import type { AttendanceCommand } from "@/lib/attendance";

export function AttendanceActionDialog({ branchId, title, description, command, correction = false, onClose, onSaved }: {
    branchId: string; title: string; description?: string; command: AttendanceCommand; correction?: boolean;
    onClose: () => void; onSaved: (result: AttendanceResult) => void;
}) {
    const [note, setNote] = useState(command.note ?? ""), [reason, setReason] = useState("");
    const [start, setStart] = useState(command.kind === "CORRECT_VISIT" ? command.checkIn : "");
    const [end, setEnd] = useState(command.kind === "CORRECT_VISIT" ? command.checkOut ?? "" : "");
    const [error, setError] = useState(""), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
    const inFlight = useRef(false), frozen = useRef<AttendanceCommand | null>(null);
    async function submit() {
        if (inFlight.current) return;
        inFlight.current = true; setBusy(true); setError("");
        const input = frozen.current ?? { ...command, note, reason,
            ...(command.kind === "CORRECT_VISIT" ? { checkIn: start, checkOut: end || null } : {}) } as AttendanceCommand;
        frozen.current = input;
        try { const result = await attendance.command(branchId, input); onSaved(result); onClose(); }
        catch (err) {
            const unknown = !(err instanceof AttendanceRequestError) || err.uncertain;
            setUncertain(unknown); if (!unknown) frozen.current = null;
            setError(err instanceof Error ? err.message : "Unable to confirm attendance");
        } finally { inFlight.current = false; setBusy(false); }
    }
    return <Dialog open closeDisabled={busy || uncertain} onClose={() => { if (!busy && !uncertain) onClose(); }} title={title} description={description}>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); void submit(); }}>
            {command.kind === "CORRECT_VISIT" && <>
                <p className="text-sm">Enter UTC timestamps ending in Z, or timestamps with an explicit offset (for example +05:30). Leave checkout empty only if the visit is still open.</p>
                <label className="block text-sm">Check-in timestamp<input className={`${formControlClass} w-full p-2`} required value={start} disabled={busy || uncertain} onChange={e => setStart(e.target.value)} /></label>
                <label className="block text-sm">Check-out timestamp<input className={`${formControlClass} w-full p-2`} value={end} disabled={busy || uncertain} onChange={e => setEnd(e.target.value)} placeholder="YYYY-MM-DDTHH:mm:ss+05:30" /></label>
            </>}
            <label className="block text-sm">Optional note<textarea className={`${formControlClass} w-full p-2`} maxLength={1000} value={note} disabled={busy || uncertain} onChange={e => setNote(e.target.value)} /></label>
            {correction && <label className="block text-sm">Correction reason<textarea className={`${formControlClass} w-full p-2`} required maxLength={1000} value={reason} disabled={busy || uncertain} onChange={e => setReason(e.target.value)} /></label>}
            {error && <p role="alert">{error}</p>}
            {uncertain && <p>Keep this dialog open and retry to recover the same action.</p>}
            <div className="flex flex-wrap justify-end gap-2">
                <AppButton variant="secondary" type="button" disabled={busy || uncertain} onClick={onClose}>Cancel</AppButton>
                <AppButton type="submit" disabled={busy || (correction && !reason.trim())}>{busy ? "Confirming…" : uncertain ? "Retry same action" : "Confirm"}</AppButton>
            </div>
        </form>
    </Dialog>;
}
