"use client";
import type { StudentListItem } from "@/lib/api/students";
import { useTranslation } from "@/components/settings/LocalizedText";
import { BasicDialog } from "./BasicDialog";
import { useBasicFormat } from "./BasicFees";
import type { BasicOperation } from "./useBasicOperation";
/** Matching records are review candidates, never evidence that this request committed. */
export function BasicAdmissionReview({ command, matches, onRecord, onFinish, onClose }: {
    command: BasicOperation; matches: StudentListItem[]; onRecord: (id: string) => void; onFinish: () => void; onClose: () => void;
}) {
    const t = useTranslation(), { money } = useBasicFormat();
    return <BasicDialog title="Review uncertain admission" onClose={onClose}>
        <p className="bp-warning" role="status">{t.owned("This admission is not confirmed. A matching student does not prove this request succeeded.")}</p>
        <p className="bp-subtle">{t.owned("Your original request and draft are saved. Nothing will be submitted again automatically.")}</p>
        <section className="bp-detail-card" aria-label={t.owned("Original admission request")}>
            <h2>{t.owned("Original admission request")}</h2><p>{String(command.body.name ?? "")} · {String(command.body.phone ?? "")}</p>
            <p>{t("Monthly fee")}: {money(Number(command.body.monthlyFee ?? 0))}</p>
            <p>{t.owned("Admission fee")}: {money(Number(command.body.admissionFee ?? 0))}</p>
        </section>
        <h2>{t.owned("Matching students to review")}</h2>
        {matches.length ? matches.map(student => <div className="bp-detail-card" key={student.id}>
            <strong>{student.name}</strong><p>{student.phone} · {t.owned(student.status)}</p>
            <button className="bp-button bp-button-secondary" onClick={() => onRecord(student.id)}>{t.owned("Review student record")}</button>
        </div>) : <p>{t.owned("No matching student was found in this branch. The admission remains unconfirmed.")}</p>}
        <p className="bp-subtle">{t.owned("Review the student and fee history before closing recovery. Closing it does not confirm or undo an admission; your draft remains saved.")}</p>
        <footer className="bp-dialog-footer"><button className="bp-button bp-button-quiet" onClick={onClose} data-dialog-initial-focus>{t("Back")}</button>
            <button className="bp-button bp-button-secondary" onClick={onFinish}>{t.owned("Close recovery and keep draft")}</button></footer>
    </BasicDialog>;
}
