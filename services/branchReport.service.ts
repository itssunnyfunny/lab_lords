import { prisma } from "@/lib/prisma";
import { remainingFee } from "@/lib/feeBalance";
import { reportQuerySchema, type BranchReport, type BranchReportQuery } from "@/lib/branchReports";
import { translateOwnedText } from "@/lib/i18n";
import { AccessPolicy } from "@/services/accessPolicy.service";
import { attendanceTimezone } from "@/lib/attendance";
import { dashboardDateOffset, dashboardDayStart } from "@/lib/dashboardMath";

export class ReportLimitError extends Error {}
function assertReportLimit(rows: unknown[]) {
    if (rows.length > 10_000) throw new ReportLimitError("This report exceeds 10,000 rows. Narrow the date range or search.");
}

export class BranchReportService {
    static async read(actorId: string, branchId: string, input: BranchReportQuery): Promise<BranchReport> {
        const query = reportQuerySchema.parse(input);
        return prisma.$transaction(async tx => {
            const access = await AccessPolicy.authorizeAction(actorId, branchId, query.kind === "fees" ? "view_payments" : "students", tx);
            const [user, organization] = await Promise.all([
                tx.user.findUniqueOrThrow({ where: { id: actorId }, select: { documentLanguage: true } }),
                tx.organization.findUniqueOrThrow({ where: { id: access.organizationId }, select: { timezone: true } }),
            ]);
            const timezone = attendanceTimezone(organization.timezone);
            const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
            const day = (instant: Date) => {
                const parts = formatter.formatToParts(instant);
                const field = (name: string) => parts.find(part => part.type === name)!.value;
                return `${field("year")}-${field("month")}-${field("day")}`;
            };
            const language = user.documentLanguage === "hi" || user.documentLanguage === "hinglish" ? user.documentLanguage : "en";
            const label = (text: string) => translateOwnedText(language, text);
            const date = query.kind === "attendance"
                ? { gte: new Date(`${query.from}T00:00:00.000Z`), lt: new Date(Date.parse(`${query.through}T00:00:00.000Z`) + 86_400_000) }
                : { gte: dashboardDayStart(query.from, timezone), lt: dashboardDayStart(dashboardDateOffset(query.through, 1), timezone) };
            const search = query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {};
            const take = 10_001;
            let columns: string[];
            let rows: (string | number)[][];
            if (query.kind === "students") {
                columns = ["Student name", "Status", "Joining date"];
                const records = await tx.student.findMany({ where: { branchId, ...search, joinedAt: date,
                    ...(query.status === "ACTIVE" || query.status === "INACTIVE" ? { status: query.status } : {}) },
                    select: { name: true, status: true, joinedAt: true }, orderBy: [{ joinedAt: "asc" }, { id: "asc" }], take });
                assertReportLimit(records);
                rows = records.map(row => [row.name, label(row.status), day(row.joinedAt)]);
            } else if (query.kind === "fees") {
                columns = ["Student name", "Fee type", "Period start", "Period end", "Fee date", "Original fee", "Collected amount", "Waived amount", "Remaining balance", "Status"];
                const records = await tx.payment.findMany({ where: { branchId, dueDate: date, student: { branchId, ...search },
                    ...(query.status === "DUE" || query.status === "PAID" || query.status === "WAIVED" ? { status: query.status } : {}) },
                    select: { student: { select: { name: true } }, type: true, periodStart: true, periodEnd: true, dueDate: true,
                        amount: true, collectedAmount: true, waivedAmount: true, ledgerBacked: true, status: true }, orderBy: [{ dueDate: "asc" }, { id: "asc" }], take });
                assertReportLimit(records);
                rows = records.map(row => [row.student.name, label(row.type), day(row.periodStart), day(row.periodEnd),
                    day(row.dueDate), row.amount,
                    !row.ledgerBacked && row.status === "PAID" ? row.amount : row.collectedAmount,
                    !row.ledgerBacked && row.status === "WAIVED" ? row.amount : row.waivedAmount,
                    remainingFee(row), label(row.status)]);
            } else {
                columns = ["Student name", "Attendance date", "Status", "Source"];
                const records = await tx.attendanceMark.findMany({ where: { branchId, date, student: { branchId, ...search },
                    ...(query.status === "PRESENT" || query.status === "ABSENT" ? { status: query.status } : {}) },
                    select: { student: { select: { name: true } }, date: true, status: true, source: true }, orderBy: [{ date: "asc" }, { id: "asc" }], take });
                assertReportLimit(records);
                rows = records.map(row => [row.student.name, row.date.toISOString().slice(0, 10), label(row.status), label(row.source)]);
            }
            return { columns: columns.map(label), rows, count: rows.length, asOf: new Date().toISOString() };
        }, { isolationLevel: "RepeatableRead", timeout: 30_000 });
    }
}
