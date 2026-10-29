"use client";
import type { FormEvent } from "react";
import type { BasicData } from "./data";
import { useTranslation } from "@/components/settings/LocalizedText";
export function BasicSetup({ data, disabled, onSave, onDirty }: {
    data: BasicData; disabled: boolean; onSave: (url: string, method: "POST" | "PATCH", body: Record<string,unknown>) => void; onDirty: () => void;
}) {
    const t = useTranslation(), root = "/branches/" + data.branch.id;
    function details(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        onSave(root, "PATCH", { name: String(form.get("name")).trim(), defaultFee: Number(form.get("fee")), defaultAdmissionFee: Number(form.get("admission")) });
    }
    return <>
        <div className="bp-page-heading"><div><h1>{t.owned("Library setup")}</h1><p>{t.owned("A few essentials. You’re ready to go.")}</p></div></div>
        <form className="bp-setup-card" onSubmit={details} onChange={onDirty}><fieldset className="bp-form-fields" disabled={disabled}>
            <label>{t.owned("Library name")}<input name="name" defaultValue={data.branch.name} required maxLength={120} /></label>
            <div className="bp-form-pair"><label>{t.owned("Default monthly fee")}<input name="fee" type="number" min="0" max="1000000" defaultValue={data.branch.defaultFee ?? 0} required /></label>
                <label>{t.owned("Admission fee")}<input name="admission" type="number" min="0" max="1000000" defaultValue={data.branch.defaultAdmissionFee ?? 0} required /></label></div>
            <p className="bp-subtle">{t.owned("Defaults are used for new students. Existing fees are preserved.")}</p>
            <button className="bp-button bp-button-primary">{t.owned("Save setup")}</button>
        </fieldset></form>
        <section className="bp-setup-card"><h2>{t("Seats")}</h2>
            <form onChange={onDirty} onSubmit={e => { e.preventDefault(); const values=new FormData(e.currentTarget); onSave(root+"/seats/generate","POST",{seatNumbering:{mode:"RANGE",ranges:[{prefix:String(values.get("prefix")??"").trim(),start:Number(values.get("start")),end:Number(values.get("end")),padTo:2,separator:""}]}}); }}>
                <fieldset className="bp-form-fields" disabled={disabled}><p>{t.owned("Add seat numbers without removing existing seats or allocations.")}</p>
                    <div className="bp-form-pair"><label>{t.owned("Prefix (optional)")}<input name="prefix" maxLength={16} /></label><label>{t.owned("From")}<input name="start" type="number" min="1" max="10000" defaultValue="1" required /></label><label>{t.owned("To")}<input name="end" type="number" min="1" max="10000" defaultValue="20" required /></label></div>
                    <button className="bp-button bp-button-secondary">{t.owned("Add seats")}</button>
                </fieldset>
            </form>
        </section>
        <section className="bp-setup-card"><h2>{t.owned("Your shifts")}</h2>
            {data.shifts.map(shift => <form key={shift.id} onChange={onDirty} onSubmit={e => { e.preventDefault(); const values=new FormData(e.currentTarget); onSave(root+"/shifts/"+shift.id,"PATCH",{name:String(values.get("name")),startTime:String(values.get("start")),endTime:String(values.get("end"))}); }}>
                <fieldset className="bp-form-fields" disabled={disabled || shift.status !== "ACTIVE"}><legend>{shift.name} · {t.owned(shift.status)}</legend>
                    <label>{t.owned("Shift name")}<input name="name" defaultValue={shift.name} required maxLength={50} /></label>
                    <div className="bp-form-pair"><label>{t.owned("From")}<input name="start" type="time" defaultValue={shift.startTime ?? ""} /></label><label>{t.owned("To")}<input name="end" type="time" defaultValue={shift.endTime ?? ""} /></label></div>
                    <button className="bp-button bp-button-secondary">{t("Save changes")}</button>
                </fieldset>
            </form>)}
            <form onChange={onDirty} onSubmit={e => { e.preventDefault(); const values=new FormData(e.currentTarget); onSave(root+"/shifts","POST",{name:String(values.get("name")),startTime:String(values.get("start")),endTime:String(values.get("end"))}); }}>
                <fieldset className="bp-form-fields" disabled={disabled}><legend>{t.owned("Add shift")}</legend>
                    <label>{t.owned("Shift name")}<input name="name" required maxLength={50} /></label>
                    <div className="bp-form-pair"><label>{t.owned("From")}<input name="start" type="time" /></label><label>{t.owned("To")}<input name="end" type="time" /></label></div>
                    <p className="bp-subtle">{t.owned("Overnight shifts are supported. Leave both times empty for a full day. Overlapping shifts cannot be added.")}</p>
                    <button className="bp-button bp-button-secondary">{t.owned("Add shift")}</button>
                </fieldset>
            </form>
        </section>
    </>;
}
