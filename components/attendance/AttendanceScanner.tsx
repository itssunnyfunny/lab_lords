"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppButton, Dialog } from "@/components/ui";
import { formControlClass } from "@/components/ui/formSurface";
import { attendance } from "@/lib/api/attendance";
import { AttendanceActionDialog } from "./AttendanceActionDialog";
import type { AttendanceCommand } from "@/lib/attendance";
import { startAttendanceCamera } from "@/lib/attendanceCamera";

export function AttendanceScanner({ branchId, onClose, onSaved }: { branchId: string; onClose: () => void; onSaved: () => void }) {
    const video = useRef<HTMLVideoElement>(null), gate = useRef(false), active = useRef(true);
    const stopCamera = useRef<() => void>(() => {});
    const [mode, setMode] = useState<"CHECK_IN" | "CHECK_OUT">("CHECK_IN"), [camera, setCamera] = useState("");
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]), [scan, setScan] = useState(0);
    const [error, setError] = useState(""), [loading, setLoading] = useState(false), [result, setResult] = useState("");
    const [identity, setIdentity] = useState<Awaited<ReturnType<typeof attendance.lookup>> | null>(null);
    const [command, setCommand] = useState<AttendanceCommand | null>(null);
    const lookup = useCallback(async (code: string) => {
        if (gate.current) return;
        gate.current = true; stopCamera.current(); setLoading(true);
        try { const found = await attendance.lookup(branchId, code); if (active.current) setIdentity(found); }
        catch (err) { if (active.current) setError(err instanceof Error ? err.message : "Code unavailable"); }
        finally { if (active.current) setLoading(false); }
    }, [branchId]);
    useEffect(() => {
        active.current = true;
        const session = startAttendanceCamera(video.current!, camera, code => { void lookup(code); }, setDevices,
            () => setError("Camera denied or unavailable. Close the scanner and use student search and manual check-in/out."));
        stopCamera.current = session.stop;
        return () => { active.current = false; session.stop(); };
    }, [camera, scan, lookup]);
    function next() { gate.current = false; setIdentity(null); setError(""); setResult(""); setScan(v => v + 1); }
    function confirm() {
        if (!identity) return;
        if (mode === "CHECK_OUT" && !identity.openVisit) { setError("No open visit. No checkout was recorded."); return; }
        setCommand(mode === "CHECK_IN" ? { key: crypto.randomUUID(), kind: "CHECK_IN", studentId: identity.student.id, source: "QR" }
            : { key: crypto.randomUUID(), kind: "CHECK_OUT", studentId: identity.student.id, visitId: identity.openVisit!.id, version: identity.openVisit!.version });
    }
    return <Dialog open closeDisabled={!!command} title="Front-desk QR scanner" onClose={() => { if (!command) onClose(); }}>
        <div className="space-y-4">
            <p className="text-sm">Confirm the student&apos;s identity before recording attendance. Scanning is supervised and does not prove identity.</p>
            <div className="flex gap-2">{(["CHECK_IN", "CHECK_OUT"] as const).map(value => <AppButton key={value} variant={mode === value ? "primary" : "secondary"} aria-pressed={mode === value} disabled={!!identity || loading || !!command} onClick={() => setMode(value)}>{value === "CHECK_IN" ? "Check in" : "Check out"}</AppButton>)}</div>
            <video ref={video} muted playsInline className="aspect-video w-full rounded-lg bg-black" aria-label="QR camera preview" />
            {devices.length > 1 && <label className="block text-sm">Camera<select className={`${formControlClass} w-full p-2`} value={camera} disabled={!!identity || loading || !!command} onChange={e => setCamera(e.target.value)}><option value="">Rear camera preferred</option>{devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}</select></label>}
            {loading && <p role="status">Looking up student…</p>}{error && <p role="alert">{error}</p>}{result && <p role="status">{result}</p>}
            {identity && <div className="space-y-2"><h3 className="font-semibold">{identity.student.name}</h3><p>{identity.student.status.toLowerCase()} · {identity.openVisit ? "Open visit recorded" : "No open visit"}</p>
                {!result && <AppButton disabled={mode === "CHECK_IN" && identity.student.status !== "ACTIVE"} onClick={confirm}>Confirm {mode === "CHECK_IN" ? "check in" : "check out"}</AppButton>}</div>}
            {(identity || error) && <AppButton variant="secondary" onClick={next}>Scan next student</AppButton>}
            <AppButton variant="secondary" onClick={onClose}>Close and use manual search</AppButton>
        </div>
        {command && <AttendanceActionDialog branchId={branchId} title={mode === "CHECK_IN" ? "Check in" : "Check out"} description={identity?.student.name} command={command} onClose={() => setCommand(null)} onSaved={r => { setResult(`${r.student?.name ?? "Student"}: ${r.message}`); onSaved(); }} />}
    </Dialog>;
}
