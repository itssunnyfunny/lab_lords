import { useTranslation } from "@/components/settings/LocalizedText";
import { assignmentState } from "@/importing/utils/guided-setup";
import type { ImportDetail, ImportRow } from "./types";
export function AssignmentSummary({ row, detail, compact = false }: { row: ImportRow; detail: ImportDetail; compact?: boolean }) {
    const t = useTranslation(), allocation = row.normalizedData?.allocation;
    const state = assignmentState(row), labels = { matched: "Matched / selected", decision: "Needs a decision", conflict: "Conflict", deferred: "Intentionally left for later" };
    const source = (fields: string[]) => detail.mapping?.columnMappings?.filter(c => fields.includes(c.targetField)).map(c => row.rawData[c.sourceColumn]).filter(Boolean).join(" · ");
    const sourceTiming = source(["shift.name", "allocation.shiftName", "multiShift.name", "allocation.multiShiftName"]), sourceSeat = source(["seat.label", "allocation.seatLabel"]);
    const shift = detail.branchContext?.shifts.find(s => s.name === allocation?.shiftName);
    const bundle = detail.branchContext?.multiShifts.find(s => s.name === allocation?.multiShiftName);
    if (compact) return <div className="mt-2 space-y-1 text-sm">
        <p>{state === "deferred" ? t.owned(labels[state]) : <>{allocation?.multiShiftName || allocation?.shiftName || t.owned("Choose timings")} · {t("Seat")} {allocation?.seatLabel || "—"}</>}</p>
        {state !== "matched" && state !== "deferred" && <p className="text-xs font-medium text-[color:var(--ui-tone-warning-text)]">{t.owned(labels[state])}</p>}
        <details className="text-xs text-[color:var(--text-secondary)]"><summary className="cursor-pointer py-1">{t.owned("Uploaded")}</summary><p>{sourceTiming || t.owned("No timing supplied")} · {sourceSeat || t.owned("No seat supplied")}</p>{bundle && <p>{t("Combined access")}: {bundle.componentShiftNames.join(" + ")}</p>}</details>
    </div>;
    return <div className="mt-3 space-y-2 border-y border-[color:var(--ui-form-section-divider)] py-3 text-sm">
        <p className="text-xs text-[color:var(--text-muted)]">{t.owned("Uploaded")}: {sourceTiming || t.owned("No timing supplied")} · {sourceSeat || t.owned("No seat supplied")}</p>
        <p className="font-medium">{t.owned(labels[state])}</p>
        {state !== "deferred" && <p>{allocation?.multiShiftName || allocation?.shiftName || t.owned("Choose timings")}{shift ? ` · ${shift.startTime ?? "00:00"}–${shift.endTime ?? "24:00"}` : ""} · {t("Seat")} {allocation?.seatLabel || "—"}</p>}
        {state !== "deferred" && bundle && <p className="text-xs">{t("Combined access")}: {bundle.componentShiftNames.join(" + ")}</p>}
    </div>;
}
