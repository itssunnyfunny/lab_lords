"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { AppButton } from "@/components/ui/AppButton";
import { formHelpTextClass, formSurfaceClass } from "@/components/ui/formSurface";
import { students, type StudentEnrollmentHistoryPage } from "@/lib/api/students";
import { financialCalendarDate } from "@/lib/feeReceiptDates";
import { cn } from "@/lib/utils";

export function StudentEnrollmentHistory({ branchId, studentId }: { branchId: string; studentId: string }) {
    const t = useTranslation();
    const { interfaceLanguage } = useUserPreferences();
    const date = (value: string) => financialCalendarDate(value, interfaceLanguage);
    const [request, setRequest] = useState<{ sequence: number; cursor?: string }>({ sequence: 0 });
    const [result, setResult] = useState<{ sequence: number; data: StudentEnrollmentHistoryPage | null; failed?: boolean }>();

    useEffect(() => {
        let current = true;
        void students.getEnrollmentHistory(branchId, studentId, request.cursor).then(data => {
            if (!current) return;
            setResult(previous => ({
                sequence: request.sequence,
                data: request.cursor && previous?.data ? { ...data, items: [...previous.data.items, ...data.items] } : data,
            }));
        }).catch(() => {
            if (current) setResult(previous => ({ sequence: request.sequence, data: previous?.data ?? null, failed: true }));
        });
        return () => { current = false; };
    }, [branchId, studentId, request]);

    const history = result?.data;
    const loading = result?.sequence !== request.sequence;
    const loadPage = (cursor?: string) => setRequest(previous => ({ cursor, sequence: previous.sequence + 1 }));

    return (
        <div className="space-y-3 text-sm">
            {history && <>
                <p>{t("Original joining date is {date}.", { date: date(history.originalJoinedAt) })}</p>
                <ul className="space-y-2">
                    {history.current && <li className={cn(formSurfaceClass, "p-3")}>
                        <p>{t("Current enrollment started {date}.", { date: date(history.current.startedAt) })}</p>
                        {history.current.billingStartAt && <p className={formHelpTextClass}>{t("Billing cycles count from {date}.", { date: date(history.current.billingStartAt) })}</p>}
                    </li>}
                    {history.items.map(enrollment => (
                        <li className={cn(formSurfaceClass, "p-3")} key={enrollment.id}>
                            <p>{t("Enrollment started {date}.", { date: date(enrollment.startedAt) })}</p>
                            <p className={formHelpTextClass}>{enrollment.endedAt
                                ? t("Student left {date}.", { date: date(enrollment.endedAt) })
                                : t("Departure date is unknown.")}</p>
                            {enrollment.billingStartAt && <p className={formHelpTextClass}>{t("Billing cycles count from {date}.", { date: date(enrollment.billingStartAt) })}</p>}
                        </li>
                    ))}
                </ul>
                {!history.current && history.items.length === 0 && <p className={formHelpTextClass}>{t("Departure date is unknown.")}</p>}
            </>}
            {loading && <p role="status">{t("Loading…")}</p>}
            {!loading && (result?.failed ? <>
                <p role="alert">{t("Unable to load enrollment history.")}</p>
                <AppButton variant="secondary" density="compact" onClick={() => loadPage(request.cursor)}>{t("Try again")}</AppButton>
            </> : history?.nextCursor && <AppButton variant="secondary" density="compact" onClick={() => loadPage(history.nextCursor ?? undefined)}>{t("Load more")}</AppButton>)}
        </div>
    );
}
