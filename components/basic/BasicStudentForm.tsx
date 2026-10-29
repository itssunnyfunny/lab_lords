"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import type { StudentListItem } from "@/lib/api/students";
import { BasicDialog } from "./BasicDialog";
import { useTranslation } from "@/components/settings/LocalizedText";
export type StudentInput = { name: string; phone?: string; monthlyFee?: number; admissionFee?: number };
export function BasicStudentForm({ student, defaultFee, admissionFee, pending, locked, error, onSave, onClose, scope, onDirty, onRecover }: {
    student?: StudentListItem; defaultFee: number; admissionFee: number; pending: boolean; locked: boolean; error: string;
    onSave: (input: StudentInput, chooseSeat: boolean) => void; onClose: () => void; scope: string; onDirty: () => void; onRecover?: () => void;
}) {
    const t = useTranslation();
    const draftKey = "basic-student-draft:v1:" + scope + ":" + (student?.id ?? "new");
    const [draft] = useState(() => { try { return JSON.parse(sessionStorage.getItem(draftKey) ?? "null") as Record<string, string> | null; } catch { return null; } });
    function changed(event: FormEvent<HTMLFormElement>) {
        onDirty();
        try { sessionStorage.setItem(draftKey, JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))); } catch { /* The navigation guard still protects this form. */ }
    }
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (locked || pending) return;
        const data = new FormData(event.currentTarget);
        const phone = String(data.get("phone") ?? "").trim();
        onSave({ name: String(data.get("name")).trim(), ...(phone ? { phone } : {}), ...(!student || Number(data.get("fee")) !== student.monthlyFee ? { monthlyFee: Number(data.get("fee")) } : {}), ...(!student ? { admissionFee: Number(data.get("admission")) } : {}) },
            (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "seat");
    }
    return <BasicDialog title={student ? "Edit student" : "Add a student"} onClose={onClose} pending={pending}>
        <p className="bp-dialog-intro">{t.owned(student ? "Keep their details up to date." : "A few details, then we’ll find them a seat.")}</p>
        <form onSubmit={submit} onChange={changed}>
            <fieldset disabled={pending || locked} className="bp-form-fields">
                <label>{t("Student name")}<input name="name" defaultValue={draft?.name ?? student?.name} autoComplete="off" required maxLength={80} data-dialog-initial-focus /></label>
                <label>{t("Mobile number")}<div className="bp-phone-input">{!student && <span>+91</span>}<input name="phone" aria-label={t("Mobile number")} type="tel" defaultValue={draft?.phone ?? student?.phone ?? ""} autoComplete="off" inputMode="numeric" pattern={student ? undefined : "[0-9]{10}"} required={!student || student.phone !== null} /></div></label>
                <label>{t("Monthly fee")}<div className="bp-money-input"><span>₹</span><input name="fee" aria-label={t("Monthly fee")} type="number" min="0" step="1" max="2147483647" defaultValue={draft?.fee ?? student?.monthlyFee ?? defaultFee} required /></div><small>{t.owned("Monthly fees start one month after joining. Changes apply to future dues.")}</small></label>
                {!student && <label>{t.owned("Admission fee")}<div className="bp-money-input"><span>₹</span><input name="admission" aria-label={t.owned("Admission fee")} type="number" min="0" step="1" max="2147483647" defaultValue={draft?.admission ?? admissionFee} required /></div><small>{t.owned("A one-time fee, due when the student joins.")}</small></label>}
            </fieldset>
            {error && <p role="alert" className="bp-error">{t.error(error)}</p>}
            {onRecover&&!pending&&<button type="button" className="bp-button bp-button-secondary" onClick={onRecover}>{t.owned("Check saved operation")}</button>}
            <footer className="bp-dialog-footer">
                <button type={student ? "button" : "submit"} className="bp-button bp-button-quiet" disabled={pending || locked} value="later" onClick={student ? onClose : undefined}>{t.owned(student ? "Cancel" : "Save for later")}</button>
                <button className="bp-button bp-button-primary" type="submit" disabled={pending || locked} value={student ? "save" : "seat"}>{t.owned(pending ? "Saving…" : student ? "Save changes" : "Save & choose seat")}<ArrowRight size={17} /></button>
            </footer>
        </form>
    </BasicDialog>;
}
