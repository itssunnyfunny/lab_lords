"use client";
import { useState } from "react";
import { BasicDialog } from "./BasicDialog";
import { useTranslation } from "@/components/settings/LocalizedText";
import { StudentRejoiningField } from "@/components/students/StudentRejoiningField";
import { validateStudentRejoiningDate } from "@/utils/studentRejoiningDate";

export function BasicStudentStatus({ name, status, pending, locked, error, onConfirm, onRecover, onClose }: {
    name: string; status: "ACTIVE" | "INACTIVE"; pending: boolean; locked: boolean; error: string;
    onConfirm: (rejoinedOn?: string) => void; onRecover?: () => void; onClose: () => void;
}) {
    const t = useTranslation();
    const inactive = status === "INACTIVE";
    const [date, setDate] = useState("");
    const rejoinedOn = validateStudentRejoiningDate(date);
    return <BasicDialog title={inactive ? "Mark student inactive" : "Reactivate student"} pending={pending} onClose={onClose}>
        <p className="bp-dialog-intro"><strong>{name}</strong></p>
        {inactive ? <>
            <p>{t("Inactive means the student has left the branch. Record daily absences in Attendance. Future monthly fees stop when the student leaves.")}</p>
            <p className="bp-subtle">{t("Current seat allocations end. Unpaid fees remain collectible and receipts stay in the student record.")}</p>
            <p className="bp-subtle">{t("If an earned fee is missing, someone with permission to generate fees must confirm the departure. That fee will be added as unpaid.")}</p>
        </> : <div className="space-y-3">
            <p>{t("Confirm the date the student returned to start a new enrollment period.")}</p>
            <StudentRejoiningField value={date} onChange={setDate} disabled={pending || locked} />
            <p className="bp-subtle">{t.owned("After reactivation, choose an available seat and shift.")}</p>
        </div>}
        {error && <p role="alert" className="bp-error">{t.error(error)}</p>}
        {onRecover && !pending && <button className="bp-button bp-button-secondary" onClick={onRecover}>{t.owned("Check saved operation")}</button>}
        <footer className="bp-dialog-footer">
            <button className="bp-button bp-button-quiet" disabled={pending} onClick={onClose} data-dialog-initial-focus>{t("Cancel")}</button>
            <button className="bp-button bp-button-primary" disabled={pending || locked || (!inactive && !rejoinedOn)} onClick={() => {
                if (inactive) onConfirm();
                else if (rejoinedOn) onConfirm(rejoinedOn);
            }}>{t.owned(pending ? "Saving…" : inactive ? "Mark inactive" : "Reactivate student")}</button>
        </footer>
    </BasicDialog>;
}
