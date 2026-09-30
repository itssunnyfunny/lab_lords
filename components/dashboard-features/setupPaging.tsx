"use client";
import { useState } from "react";
import { AppButton } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { DASHBOARD_SETUP_PAGE_SIZE, type DashboardSetupPage } from "@/lib/dashboardSetup";
import { useDashboardResource } from "./shared";

export function useDashboardSetup<T>(branchId: string, kind: "expectations" | "terms", initialStudentId = "") {
    const [studentId, setStudentId] = useState(initialStudentId);
    const [recordCursors, setRecordCursors] = useState<string[]>([]);
    const [studentCursors, setStudentCursors] = useState<string[]>([]);
    const query = new URLSearchParams({ limit: String(DASHBOARD_SETUP_PAGE_SIZE) });
    if (studentId) query.set("studentId", studentId);
    if (recordCursors.length) query.set("cursor", recordCursors.at(-1)!);
    if (studentCursors.length) query.set("studentCursor", studentCursors.at(-1)!);
    const resource = useDashboardResource<DashboardSetupPage<T>>(`/api/branches/${branchId}/dashboard/${kind}?${query}`);
    const page = (cursors: string[], setCursors: typeof setRecordCursors, nextCursor: string | null | undefined) => ({
        index: cursors.length,
        previous: () => setCursors(current => current.slice(0, -1)),
        next: () => {
            if (!resource.loading && nextCursor) setCursors(current => current.at(-1) === nextCursor ? current : [...current, nextCursor]);
        },
        hasNext: Boolean(nextCursor),
        loading: resource.loading,
    });
    const options = resource.data?.students ?? [];
    const selected = resource.data?.selectedStudent;
    return {
        ...resource, studentId,
        select: (id: string) => { setStudentId(id); setRecordCursors([]); },
        students: selected && !options.some(option => option.id === selected.id) ? [...options, selected] : options,
        recordsPage: page(recordCursors, setRecordCursors, resource.data?.nextCursor),
        studentsPage: page(studentCursors, setStudentCursors, resource.data?.studentNextCursor),
    };
}

export function SetupPager({ label, count, total, page, disabled = false }: {
    label: string; count: number; total: number | null; disabled?: boolean;
    page: { index: number; previous: () => void; next: () => void; hasNext: boolean; loading: boolean };
}) {
    const t = useTranslation(); const { formatNumber } = useUserPreferences();
    const first = count ? page.index * DASHBOARD_SETUP_PAGE_SIZE + 1 : 0;
    const last = count ? first + count - 1 : 0;
    return <div className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label={label}>
        <p>{label}: {total === null ? "—" : `${formatNumber(first)}–${formatNumber(last)} / ${formatNumber(total)}`}</p>
        <div className="flex gap-2">
            <AppButton density="compact" variant="secondary" aria-label={`${t("Previous")} ${label}`} disabled={disabled || page.loading || page.index === 0} onClick={() => { if (!disabled && !page.loading && page.index > 0) page.previous(); }}>{t("Previous")}</AppButton>
            <AppButton density="compact" variant="secondary" aria-label={`${t("Next")} ${label}`} disabled={disabled || page.loading || !page.hasNext} onClick={() => { if (!disabled && !page.loading && page.hasNext) page.next(); }}>{t("Next")}</AppButton>
        </div>
    </div>;
}
