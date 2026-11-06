"use client";
import { useState } from "react";
import { AppButton, AppPanel } from "@/components/ui";
import { LocalizedError, useTranslation } from "@/components/settings/LocalizedText";
import { importSessions } from "@/lib/api/importSessions";
import type { ImportCorrectionPreview, ImportConfigurationCorrection } from "@/importing/contracts/import-correction.contract";
import { parseImportMoney } from "@/importing/utils/row-normalizer";
import type { ImportDetail } from "./types";
import { importFieldClass } from "./shared";

export function ImportConfigurationCorrection({ branchId, detail, section, disabled, onApply, onDirtyChange }: {
    branchId: string; detail: ImportDetail; section: "timings" | "seats"; disabled: boolean;
    onApply: (preview: ImportCorrectionPreview) => Promise<boolean>; onDirtyChange: (dirty: boolean) => void;
}) {
    const t = useTranslation();
    const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null), [preview, setPreview] = useState<ImportCorrectionPreview | null>(null);
    const [seatLabels, setSeatLabels] = useState<Record<string, string>>({});
    const [shiftId, setShiftId] = useState("");
    const [timing, setTiming] = useState({ name: "", startTime: "", endTime: "", price: "" });
    const existing = detail.existingBranchContext;
    const changed = () => { setPreview(null); onDirtyChange(true); };
    const reset = () => { setOpen(false); setPreview(null); setError(null); setSeatLabels({}); setShiftId(""); onDirtyChange(false); };
    const inspect = async () => {
        setBusy(true); setError(null); setPreview(null);
        try {
            let correction: ImportConfigurationCorrection;
            if (section === "seats") correction = { kind: "RENAME_SEATS", seats: Object.entries(seatLabels).filter(([id, label]) => label !== existing?.seats.find(s => s.id === id)?.label).map(([id, label]) => ({ id, label })) };
            else {
                const price = parseImportMoney(timing.price);
                if (price === undefined) throw new Error("Use whole non-negative rupee amounts. Recorded amounts will not be rounded.");
                correction = { kind: "UPDATE_TIMING", id: shiftId, ...timing, price };
            }
            setPreview(await importSessions.previewCorrection(branchId, detail.id, correction));
        } catch (e) { setError(e instanceof Error ? e.message : "Could not preview correction."); }
        finally { setBusy(false); }
    };
    return <AppPanel density="compact" title={t.owned(section === "seats" ? "Correct existing seat numbering" : "Correct existing timings")} description={t.owned(section === "seats" ? "Rename the same physical seats without adding capacity. Seat identity and allocation history stay attached." : "Change an existing timing and review its effect on allocations, combined access and linked monthly fees.")}>
        {!open ? <AppButton density="compact" variant="secondary" disabled={disabled} onClick={() => setOpen(true)}>{t.owned(section === "seats" ? "Rename existing seats" : "Review a timing correction")}</AppButton>
        : <div className="space-y-4">
            <p className="text-sm">{t.owned("These corrections change existing branch configuration immediately after confirmation. They do not import students. Draft additions still wait for final import.")}</p>
            {error && <p role="alert"><LocalizedError error={error} /></p>}
            <fieldset disabled={disabled || busy} className="space-y-3">
                {section === "seats" ? <div className="grid max-h-96 gap-3 overflow-y-auto sm:grid-cols-2">{existing?.seats.map(seat => <label className="block text-sm" key={seat.id}>{t.owned("Rename seat {label} to", { label: seat.label })}<input className={`mt-1 w-full ${importFieldClass}`} value={seatLabels[seat.id] ?? seat.label} onChange={event => { setSeatLabels({ ...seatLabels, [seat.id]: event.target.value }); changed(); }} /></label>)}</div>
                    : <><label className="block text-sm">{t.owned("Existing timing")}<select className={`mt-1 w-full ${importFieldClass}`} value={shiftId} onChange={event => {
                        const shift = existing?.shifts.find(s => s.id === event.target.value); setShiftId(event.target.value);
                        if (shift) setTiming({ name: shift.name, startTime: shift.startTime ?? "", endTime: shift.endTime ?? "", price: String(shift.price) }); changed();
                    }}><option value="">{t("Choose a shift")}</option>{existing?.shifts.map(shift => <option key={shift.id} value={shift.id}>{shift.name} · {shift.startTime}–{shift.endTime} · ₹{shift.price}</option>)}</select></label>
                    {shiftId && <div className="grid gap-3 sm:grid-cols-2">{([["name", "Timing name", "text"], ["startTime", "Start time", "time"], ["endTime", "End time", "time"], ["price", "Monthly price", "text"]] as const).map(([field, label, type]) => <label className="block text-sm" key={field}>{t.owned(label)}<input type={type} className={`mt-1 w-full ${importFieldClass}`} value={timing[field]} onChange={event => { setTiming({ ...timing, [field]: event.target.value }); changed(); }} /></label>)}</div>}</>}
                <div className="flex gap-2"><AppButton density="compact" onClick={() => void inspect()}>{t.owned("Preview affected records")}</AppButton><AppButton density="compact" variant="quiet" onClick={reset}>{t("Reset changes")}</AppButton></div>
            </fieldset>
            {preview && <div className="space-y-3 rounded border border-[color:var(--ui-form-surface-border)] p-3 text-sm">
                <ul>{preview.changes.map(change => <li key={change.before}>{change.before} → <strong>{change.after}</strong></li>)}</ul>
                <p>{t.owned("Affected: {students} students, {active} active allocations, {history} allocation history records and {rows} rows across {drafts} import drafts.", { students: preview.students, active: preview.activeAllocations, history: preview.historyAllocations, rows: preview.draftRows, drafts: preview.drafts })}</p>
                {section === "timings" && <><p>{t.owned("Students with a directly linked fee: {count}. Their monthly fee follows the new timing price. Existing payment records and uploaded fixed fees stay unchanged.", { count: preview.linkedFees })}</p><p>{t.owned("Combined access affected: {names}. Component times follow this timing; each combination keeps its own price.", { names: preview.combinedAccess.join(", ") || "—" })}</p></>}
                <p>{t.owned("Affected drafts are revalidated. Manual confirmations remain; old reviewed plans must be refreshed.")}</p>
                {!!preview.conflicts.length && <ul role="alert" className="list-disc pl-5">{preview.conflicts.map(message => <li key={message}>{t.owned(message)}</li>)}</ul>}
                <AppButton density="compact" disabled={disabled || busy || !!preview.conflicts.length} onClick={() => { void onApply(preview).then(ok => { if (ok) reset(); }); }}>{t.owned("Confirm correction to existing setup")}</AppButton>
            </div>}
        </div>}
    </AppPanel>;
}
