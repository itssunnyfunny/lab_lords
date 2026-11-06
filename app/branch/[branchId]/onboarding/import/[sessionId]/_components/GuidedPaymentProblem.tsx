"use client";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import type { ImportRow } from "./types";

/** Explains a held fact; never changes eligibility or the recorded payment. */
export function GuidedPaymentProblem({ row, explain = false }: { row: ImportRow; explain?: boolean }) {
    const t = useTranslation(), { formatDate } = useUserPreferences();
    if (!row.issues.some(issue => issue.code === "PAYMENT_BEFORE_DUE_REVIEW")) return null;
    const outcome = row.paymentOutcome;
    return <div className="space-y-2 text-sm">
        <p>{t.owned("Payment recorded before the due date")}{outcome?.dueDate ? ` · ${formatDate(outcome.dueDate)}` : ""}{explain && outcome?.businessDate && <> · {t.owned("Checked on {date}.", { date: formatDate(`${outcome.businessDate}T12:00:00`) })}</>}</p>
        {explain && <>
            <p>{t.owned("Check the original joining date and payment below. Correct them only if the source is wrong.")}</p>
            <p>{t.owned("If these facts are correct, keep this student pending. Recheck on or after the due date, then review and import. No early due or advance payment will be created.")}</p>
            <p>{t.owned("Keeping pending does not exclude the student or change Paid to Due.")}</p>
        </>}
    </div>;
}
