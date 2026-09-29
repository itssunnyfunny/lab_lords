import { z } from "zod";

export const DASHBOARD_SETUP_PAGE_SIZE = 50;
const id = z.string().min(1).max(128);
export const dashboardSetupQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(DASHBOARD_SETUP_PAGE_SIZE),
    cursor: id.optional(),
    studentCursor: id.optional(),
    studentId: id.optional(),
});

export type DashboardStudentOption = { id: string; name: string };
export type DashboardExpectation = { id: string; studentId: string; studentName: string; weekdays: number[]; expectedBy: string; enabled: boolean };
export type DashboardSetupPage<T> = {
    items: T[];
    nextCursor: string | null;
    total: number;
    students: DashboardStudentOption[];
    studentNextCursor: string | null;
    studentTotal: number;
    selectedStudent: DashboardStudentOption | null;
    selectedItem: T | null;
};
