import { ImportSessionService } from "./import-session.service";
import { isGuidedImport, importBusinessDate } from "../utils/current-month-import";
import { guidedPaymentChoice, type GuidedPaymentResolution } from "../utils/guided-payment-choice";
import { ImportRevisionConflictError, ImportValidationError } from "../utils/import-errors";
import type { ImportNormalizedRow } from "../contracts/import-session.contract";
import { MAX_IMPORT_ROWS } from "../constants/import-limits";

export class ImportPaymentChoiceService {
    private static async context(userId: string, branchId: string, sessionId: string) {
        const detail = await ImportSessionService.getSessionDetail(userId, branchId, sessionId);
        if (!isGuidedImport(detail.sourceConfiguration)) throw new Error("Import session not found");
        const asOf = new Date();
        return { detail, review: { draftRevision: detail.draftRevision, businessDate: importBusinessDate(asOf),
            rows: detail.rows.filter(row => !row.skipped).map(row => guidedPaymentChoice(row, detail.mapping.columnMappings, asOf)) } };
    }
    static async preview(userId: string, branchId: string, sessionId: string) {
        return (await this.context(userId, branchId, sessionId)).review;
    }
    static async apply(userId: string, branchId: string, sessionId: string, input: GuidedPaymentResolution) {
        const { detail, review } = await this.context(userId, branchId, sessionId);
        if (input.expectedRevision !== detail.draftRevision) throw new ImportRevisionConflictError();
        if (input.businessDate !== review.businessDate) throw new ImportValidationError("The business date changed. Review payment choices again.");
        if (input.action !== "DUE" && input.action !== "PAID") throw new ImportValidationError("Choose Due or selected Paid payments.");
        const ids = input.action === "DUE" ? input.rowIds : Array.isArray(input.payments) ? input.payments.map(p => p?.rowId) : undefined;
        if (!Array.isArray(ids) || !ids.length || ids.length > MAX_IMPORT_ROWS || new Set(ids).size !== ids.length
            || ids.some(id => typeof id !== "string" || id.length > 300)) throw new ImportValidationError("Choose the payments to review.");
        const rows = new Map(detail.rows.map(row => [row.id, row]));
        const choices = new Map(review.rows.map(row => [row.rowId, row]));
        const edits = ids.map(rowId => {
            const row = rows.get(rowId), choice = choices.get(rowId);
            if (!row || !choice || !(input.action === "DUE" ? choice.dueEligible : choice.paidEligible)) {
                throw new ImportValidationError("A selected payment is no longer eligible. Refresh the review; source and confirmed facts stay unchanged.");
            }
            const data = structuredClone(row.normalizedData ?? {}) as ImportNormalizedRow;
            if (input.action === "DUE") data.payment = { status: "DUE", decision: "KEEP_DUE" };
            else {
                const payment = input.payments.find(p => p.rowId === rowId)!;
                if (!["CASH", "UPI", "BANK_TRANSFER"].includes(payment.method)
                    || (payment.referenceId !== undefined && (typeof payment.referenceId !== "string" || payment.referenceId.length > 100))) {
                    throw new ImportValidationError("Confirm a payment method for every selected payment.");
                }
                data.payment = { status: "PAID", amount: choice.outcome.amount!, method: payment.method,
                    ...(payment.referenceId?.trim() ? { referenceId: payment.referenceId.trim() } : {}), decision: "CONFIRMED_PAID" };
            }
            return { rowId, normalizedData: data };
        });
        // The normal staged mutation reauthorizes, locks and checks the same
        // revision before writing, then validates every affected decision.
        return ImportSessionService.updateRows(userId, branchId, sessionId, { expectedRevision: input.expectedRevision, edits }, undefined, true);
    }
}
