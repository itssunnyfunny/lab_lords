"use client";
import { useState } from "react";
import { AppButton, AppPanel } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { emptyImportSetup, setupKey, type ImportSetup, type SetupResolution } from "@/importing/utils/guided-setup";
import { importFieldClass } from "./shared";
import type { ImportDetail } from "./types";

type Props = { detail: ImportDetail; section: "timings" | "seats"; disabled: boolean; canConfigure: boolean;
    onResolve: (input: Omit<SetupResolution, "expectedRevision">) => Promise<boolean>;
    onSetup: (setup: ImportSetup) => Promise<boolean>; onDirtyChange: (dirty: boolean) => void };
const hours = (s: { startTime: string | null; endTime: string | null }) => `${s.startTime ?? "00:00"}–${s.endTime ?? "24:00"}`;

function MatchGroup({ value, count, choices, disabled, onMatch, onDefer }: { value: string; count: number; choices: { id: string; name: string }[]; disabled: boolean; onMatch: (id: string) => void; onDefer: () => void }) {
    const t = useTranslation();
    const matched = choices.find(c => setupKey(c.name) === setupKey(value));
    const [editing, setEditing] = useState(!matched), [target, setTarget] = useState(matched?.id ?? "");
    return <div className="min-w-0 rounded border border-[color:var(--ui-form-section-divider)] p-4">
        <p className="break-words font-medium">{value || t.owned("Not supplied in the file")} <span className="text-sm font-normal">· {t("Students: {count}", { count })}</span></p>
        <p className="mt-2 text-sm">{t.owned(matched ? "Matched / selected" : "Needs a decision")}{matched ? ` · ${matched.name}` : ""}</p>
        {!editing ? <AppButton variant="quiet" density="compact" className="mt-2" disabled={disabled} onClick={() => setEditing(true)}>{t("Edit")}</AppButton> : <div className="mt-3 space-y-3">
            <label className="block text-sm">{t.owned("Use for this group")}<select aria-label={t.owned("Use for this group")} className={`${importFieldClass} mt-1 w-full`} value={target} disabled={disabled} onChange={e => setTarget(e.target.value)}>
                <option value="">{t.owned("Choose a match")}</option>{choices.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
            <div className="flex flex-wrap gap-2"><AppButton density="compact" disabled={disabled || !target} onClick={() => onMatch(target)}>{t.owned("Apply to matching students")}</AppButton><AppButton density="compact" variant="quiet" disabled={disabled} onClick={onDefer}>{t("Add seating later")}</AppButton></div>
        </div>}
    </div>;
}

export function GuidedSetupReview({ detail, section, disabled, canConfigure, onResolve, onSetup, onDirtyChange }: Props) {
    const t = useTranslation();
    const setup = detail.mapping?.importOptions?.preparedSetup ?? emptyImportSetup();
    const branch = detail.branchContext, existing = detail.existingBranchContext ?? branch;
    const [kind, setKind] = useState<"shift" | "combination">("shift");
    const [name, setName] = useState(""), [startTime, setStart] = useState(""), [endTime, setEnd] = useState(""), [price, setPrice] = useState("");
    const [components, setComponents] = useState<string[]>([]), [seatLabels, setSeatLabels] = useState("");
    const [open, setOpen] = useState(false);
    const groups = detail.guidance?.setup?.[section] ?? [];
    const counts = detail.guidance?.setup?.counts;
    const choices = section === "timings" ? [...(branch?.shifts ?? []), ...(branch?.multiShifts ?? [])] : (branch?.seats ?? []).map(s => ({ id: s.id, name: s.label }));
    const reset = () => { setName(""); setStart(""); setEnd(""); setPrice(""); setComponents([]); setSeatLabels(""); setOpen(false); onDirtyChange(false); };
    const prepare = async () => {
        const next = section === "seats" ? { ...setup, seats: [...setup.seats, ...seatLabels.split(/[\n,]+/).map(v => v.trim()).filter(Boolean)] }
            : kind === "shift" ? { ...setup, shifts: [...setup.shifts, { name, startTime, endTime, price: Number(price) }] }
                : { ...setup, multiShifts: [...setup.multiShifts, { name, componentShiftNames: components, price: Number(price) }] };
        if (await onSetup(next)) reset();
    };
    const prepared = section === "timings" ? [...setup.shifts.map(s => ({ ...s, kind: "shifts" as const, summary: `${hours(s)} · ₹${s.price}` })), ...setup.multiShifts.map(s => ({ ...s, kind: "multiShifts" as const, summary: `${s.componentShiftNames.join(" + ")} · ₹${s.price}` }))]
        : setup.seats.map(name => ({ name, kind: "seats" as const, summary: t.owned("Physical seat") }));
    const remove = (item: typeof prepared[number]) => onSetup({ ...setup, [item.kind]: item.kind === "seats"
        ? setup.seats.filter(label => label !== item.name) : setup[item.kind].filter(s => s.name !== item.name) });
    return <div className="space-y-5">
        <AppPanel density="compact" title={t.owned(section === "timings" ? "Your branch timings" : "Physical seats and assignments")} description={t.owned("Existing setup is available here. Proposed additions stay in this draft until the final import.")}>
            {section === "timings" && !existing?.shifts.length && <p className="text-sm">{t.owned("No daily timings are set up yet. Prepare one below or leave seating for later.")}</p>}
            {section === "timings" ? <div className="grid gap-3 sm:grid-cols-2">{existing?.shifts.map(s => <div className="rounded border border-[color:var(--ui-form-section-divider)] p-3" key={s.id}><strong>{s.name}</strong><p className="mt-1 text-sm">{hours(s)} · ₹{s.price}</p><small>{t.owned("Existing daily timing")}</small></div>)}{existing?.multiShifts.map(s => <div className="rounded border border-[color:var(--ui-form-section-divider)] p-3" key={s.id}><strong>{s.name}</strong><p className="mt-1 text-sm">{t("Combined access")} · ₹{s.price}</p><p className="mt-1 text-sm">{s.componentShiftNames.map(n => { const shift = existing.shifts.find(s => s.name === n); return shift ? `${n} ${hours(shift)}` : n; }).join(" + ")}</p></div>)}</div>
                : <><p className="text-sm">{t.owned("Existing physical seats")}: {existing?.seats.length ?? 0}</p><div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto" aria-label={t("Seat labels")}>{existing?.seats.map(s => <span className="rounded border border-[color:var(--ui-form-section-divider)] px-3 py-2 text-sm" key={s.id}>{s.label}</span>)}</div>
                    {counts && <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{([["matched", "Matched / selected"], ["decision", "Needs a decision"], ["conflict", "Conflict"], ["deferred", "Intentionally left for later"]] as const).map(([state, label]) => <div key={state}><dt className="text-sm">{t.owned(label)}</dt><dd className="text-xl font-semibold">{counts[state]}</dd></div>)}</dl>}
                    {!!counts && counts.decision + counts.conflict > 0 && <AppButton className="mt-4" density="compact" variant="secondary" disabled={disabled || open} onClick={() => void onResolve({ action: "DEFER_UNRESOLVED" })}>{t.owned("Leave unresolved seating for later")}</AppButton>}
                    <p className="mt-3 text-sm">{t.owned("Explicit seat labels are matched for you. Open an assignment below to see live occupancy and conflicts in this draft.")}</p></>}
        </AppPanel>
        <AppPanel density="compact" title={t.owned(section === "timings" ? "Match uploaded timings" : "Match uploaded seat labels")} description={t.owned("One answer applies to every student with the same value. Missing information is shown separately.")}>
            <div className="grid gap-3 md:grid-cols-2">{groups.map(group => <MatchGroup key={`${detail.draftRevision}:${group.value}`} {...group} choices={choices} disabled={disabled || open} onMatch={targetId => void onResolve({ action: section === "timings" ? "TIMING" : "SEAT", source: group.value, targetId })} onDefer={() => void onResolve({ action: "DEFER_GROUP", source: group.value, group: section === "timings" ? "timing" : "seat" })} />)}</div>
            {!groups.length && <p className="text-sm">{t.owned("No assignments need matching. Deliberately deferred seating stays available in the student list.")}</p>}
        </AppPanel>
        <AppPanel density="compact" title={t.owned("Proposed additions")}>
            {!prepared.length && <p className="text-sm">{t.owned("Nothing new is proposed.")}</p>}
            {prepared.map(item => <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--ui-form-section-divider)] py-3" key={item.name}><div><strong>{item.name}</strong><p className="text-sm">{item.summary}</p></div><AppButton density="compact" variant="quiet" disabled={disabled || !canConfigure || open} onClick={() => void remove(item)}>{t("Remove")}</AppButton></div>)}
            {!canConfigure && <p className="mt-3 text-sm">{t.owned("Ask someone with branch setup permission to prepare additions.")}</p>}
            {!open ? <AppButton className="mt-4" variant="secondary" density="compact" disabled={disabled || !canConfigure} onClick={() => setOpen(true)}>{t.owned(section === "timings" ? "Prepare a missing timing or combination" : "Prepare missing seats")}</AppButton> : <form className="mt-4 space-y-4" onChange={() => onDirtyChange(true)} onSubmit={e => { e.preventDefault(); void prepare(); }}>
                <fieldset disabled={disabled || !canConfigure} className="space-y-4"><legend className="sr-only">{t.owned("Prepare setup")}</legend>
                    {section === "seats" ? <label className="block text-sm">{t.owned("Seat labels, separated by commas")}<textarea className={`${importFieldClass} mt-1 w-full`} required value={seatLabels} onChange={e => setSeatLabels(e.target.value)} placeholder="A1, A2, A3" /></label> : <>
                        <label className="block text-sm">{t.owned("Type of access")}<select aria-label={t.owned("Type of access")} className={`${importFieldClass} mt-1 w-full`} value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="shift">{t("Single timing")}</option><option value="combination">{t("Combined access")}</option></select></label>
                        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">{t.owned("Timing name")}<input className={`${importFieldClass} mt-1 w-full`} required maxLength={50} value={name} onChange={e => setName(e.target.value)} /></label><label className="block text-sm">{t.owned("Standard monthly fee (₹)")}<input className={`${importFieldClass} mt-1 w-full`} required inputMode="numeric" pattern="[0-9]+" value={price} onChange={e => setPrice(e.target.value)} /></label></div>
                        {kind === "shift" ? <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">{t("Start time")}<input type="time" className={`${importFieldClass} mt-1 w-full`} required value={startTime} onChange={e => setStart(e.target.value)} /></label><label className="block text-sm">{t("End time")}<input type="time" className={`${importFieldClass} mt-1 w-full`} required value={endTime} onChange={e => setEnd(e.target.value)} /></label></div> : <fieldset><legend className="text-sm">{t.owned("Include at least two daily timings")}</legend>{branch?.shifts.map(s => <label key={s.id} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={components.includes(s.name)} onChange={e => setComponents(e.target.checked ? [...components, s.name] : components.filter(n => n !== s.name))} />{s.name} · {hours(s)}</label>)}</fieldset>}
                        <p className="text-sm">{t.owned("This is a shared timing price. Individual student fees stay unchanged.")}</p>
                    </>}
                    <div className="flex gap-3"><AppButton type="submit" density="compact">{t.owned("Keep in import draft")}</AppButton><AppButton type="button" density="compact" variant="quiet" onClick={reset}>{t("Cancel")}</AppButton></div>
                </fieldset>
            </form>}
        </AppPanel>
    </div>;
}
