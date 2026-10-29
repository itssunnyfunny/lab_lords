"use client";
import { BasicDialog } from "./BasicDialog";
import { useTranslation } from "@/components/settings/LocalizedText";
export function BasicStudentStatus({ name, status, pending, locked, error, onConfirm, onRecover, onClose }: {
    name: string; status: "ACTIVE" | "INACTIVE"; pending: boolean; locked: boolean; error: string;
    onConfirm: () => void; onRecover?: () => void; onClose: () => void;
}) {
    const t = useTranslation();
    const inactive = status === "INACTIVE";
    return <BasicDialog title={inactive ? "Mark student inactive" : "Reactivate student"} pending={pending} onClose={onClose}>
        <p className="bp-dialog-intro"><strong>{name}</strong></p>
        <p>{t.owned(inactive
            ? "The student becomes inactive and all current seat allocations end. Unpaid fees, partial payments and receipt history stay unchanged."
            : "The student becomes active again. Previous seats are not restored. The original joining date and existing monthly fee rules stay unchanged.")}</p>
        {!inactive && <p className="bp-subtle">{t.owned("After reactivation, choose an available seat and shift.")}</p>}
        {error && <p role="alert" className="bp-error">{t.error(error)}</p>}
        {onRecover && !pending && <button className="bp-button bp-button-secondary" onClick={onRecover}>{t.owned("Check saved operation")}</button>}
        <footer className="bp-dialog-footer">
            <button className="bp-button bp-button-quiet" disabled={pending} onClick={onClose} data-dialog-initial-focus>{t("Cancel")}</button>
            <button className="bp-button bp-button-primary" disabled={pending || locked} onClick={onConfirm}>{t.owned(pending ? "Saving…" : inactive ? "Mark inactive" : "Reactivate student")}</button>
        </footer>
    </BasicDialog>;
}
